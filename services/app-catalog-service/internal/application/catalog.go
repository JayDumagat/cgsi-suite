package application

import (
	"context"

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
	CDEXHref string
	BILSHref string
	HUMAHref string
	RDESHref string
}

type Catalog struct {
	identity      IdentityProvider
	authorization AuthorizationChecker
	catalog       *domain.Catalog
}

func NewCatalog(config Config, identity IdentityProvider, authorization AuthorizationChecker) *Catalog {
	return &Catalog{
		identity:      identity,
		authorization: authorization,
		catalog: domain.NewCatalog([]domain.App{
			{ID: "crm", Name: "CDEX", Description: "Manage customer relationships, accounts, and sales activity.", Href: config.CDEXHref, Initials: "CX", Accent: "success", Status: domain.AppStatusComingSoon},
			{ID: "billing", Name: "BILS", Description: "Billing and invoice lifecycle system.", Href: config.BILSHref, Initials: "BI", Accent: "warning", Status: domain.AppStatusComingSoon},
			{ID: "huma", Name: "HUMA", Description: "Human resources information system.", Href: config.HUMAHref, Initials: "HR", Accent: "brand", Status: domain.AppStatusComingSoon},
			{ID: "rdes", Name: "RDES", Description: "Ticketing and support system.", Href: config.RDESHref, Initials: "RD", Accent: "brand", Status: domain.AppStatusComingSoon},
		}),
	}
}

func (c *Catalog) ListApps(ctx context.Context, cookie string) ([]domain.App, error) {
	user, err := c.identity.SessionUser(ctx, cookie)
	if err != nil {
		return nil, err
	}

	apps := c.catalog.Apps()
	for index, app := range apps {
		if app.IsAvailable() {
			allowed, accessErr := c.authorization.CanAccess(ctx, user.OID, "app:"+app.ID)
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

	user, err := c.identity.SessionUser(ctx, cookie)
	if err != nil {
		return err
	}
	allowed, err := c.authorization.CanAccess(ctx, user.OID, "app:"+target.ID)
	if err != nil {
		return err
	}
	if !allowed {
		return domain.ErrForbidden
	}
	return nil
}
