package application

import (
	"context"
	"fmt"

	"cgsi-suite/services/app-catalog-service/internal/domain"
)

type IdentityProvider interface {
	SessionUser(context.Context, string) (AuthenticatedPrincipal, error)
}

type AuthorizationChecker interface {
	CanAccess(context.Context, string, string) (bool, error)
}

type AuthenticatedPrincipal struct {
	OID string
}

type Config struct {
	CDEXHref      string
	BILSHref      string
	ERISHref      string
	RDESHref      string
	CDEXAvailable bool
	BILSAvailable bool
	ERISAvailable bool
}

type Catalog struct {
	identity      IdentityProvider
	authorization AuthorizationChecker
	catalog       *domain.Catalog
}

// Access scopes use business domains, while the catalog and gateway keep the
// deployed application identifiers. In particular, ERIS is the HRIS module.
var accessScopeByAppID = map[string]string{
	"crm":     "crm",
	"billing": "billing",
	"eris":    "hris",
	"rdes":    "rdes",
}

func NewCatalog(config Config, identity IdentityProvider, authorization AuthorizationChecker) *Catalog {
	return &Catalog{
		identity:      identity,
		authorization: authorization,
		catalog: domain.NewCatalog([]domain.App{
			{ID: "crm", Name: "CDEX", Description: "Manage customer relationships, accounts, and sales activity.", Href: config.CDEXHref, Initials: "CX", Accent: "success", Status: appStatus(config.CDEXAvailable)},
			{ID: "billing", Name: "BILS", Description: "Billing and invoice lifecycle system.", Href: config.BILSHref, Initials: "BI", Accent: "warning", Status: appStatus(config.BILSAvailable)},
			{ID: "eris", Name: "ERIS", Description: "Human resources information system.", Href: config.ERISHref, Initials: "ER", Accent: "brand", Status: appStatus(config.ERISAvailable)},
			{ID: "rdes", Name: "RDES", Description: "Ticketing and support system.", Href: config.RDESHref, Initials: "RD", Accent: "brand", Status: domain.AppStatusComingSoon},
		}),
	}
}

func appStatus(available bool) domain.AppStatus {
	if available {
		return domain.AppStatusAvailable
	}
	return domain.AppStatusComingSoon
}

func (c *Catalog) ListApps(ctx context.Context, cookie string) ([]domain.App, error) {
	user, err := c.identity.SessionUser(ctx, cookie)
	if err != nil {
		return nil, err
	}

	apps := c.catalog.Apps()
	for index, app := range apps {
		if app.IsAvailable() {
			scope, exists := accessScopeByAppID[app.ID]
			if !exists {
				return nil, fmt.Errorf("no access scope configured for app %q", app.ID)
			}
			allowed, accessErr := c.authorization.CanAccess(ctx, user.OID, "app:"+scope)
			if accessErr != nil {
				return nil, accessErr
			}
			apps[index] = app.WithAccess(allowed)
		}
	}
	return apps, nil
}

func (c *Catalog) CheckAppAccess(ctx context.Context, cookie, appID string) error {
	target, exists := c.catalog.Find(appID)
	if !exists || !target.IsAvailable() {
		return domain.ErrForbidden
	}
	scope, exists := accessScopeByAppID[target.ID]
	if !exists {
		return domain.ErrForbidden
	}

	user, err := c.identity.SessionUser(ctx, cookie)
	if err != nil {
		return err
	}
	allowed, err := c.authorization.CanAccess(ctx, user.OID, "app:"+scope)
	if err != nil {
		return err
	}
	if !allowed {
		return domain.ErrForbidden
	}
	return nil
}
