package application

import (
	"context"
	"errors"
	"testing"

	"cgsi-suite/services/app-catalog-service/internal/domain"
)

type identityStub struct {
	user  AuthenticatedPrincipal
	err   error
	calls int
}

func (stub *identityStub) SessionUser(context.Context, string) (AuthenticatedPrincipal, error) {
	stub.calls++
	return stub.user, stub.err
}

type authorizationStub struct {
	allowed bool
	answers int
}

func (stub *authorizationStub) CanAccess(context.Context, string, string) (bool, error) {
	stub.answers++
	return stub.allowed, nil
}

func TestListAppsRequiresAnAuthenticatedEmployee(t *testing.T) {
	identity := &identityStub{err: domain.ErrUnauthenticated}
	authorization := &authorizationStub{allowed: true}
	catalog := NewCatalog(Config{}, identity, authorization)

	if _, err := catalog.ListApps(context.Background(), "session=bad"); !errors.Is(err, domain.ErrUnauthenticated) {
		t.Fatalf("ListApps() error = %v, want unauthenticated", err)
	}
	if authorization.answers != 0 {
		t.Fatalf("authorization was called %d times for an unauthenticated request", authorization.answers)
	}
}

func TestListAppsDoesNotAdvertiseComingSoonAppsAsAccessible(t *testing.T) {
	identity := &identityStub{user: AuthenticatedPrincipal{OID: "entra-user"}}
	authorization := &authorizationStub{allowed: true}
	catalog := NewCatalog(Config{}, identity, authorization)

	apps, err := catalog.ListApps(context.Background(), "session=valid")
	if err != nil {
		t.Fatal(err)
	}
	if len(apps) != 4 {
		t.Fatalf("got %d catalog apps, want 4", len(apps))
	}
	for _, app := range apps {
		if app.CanAccess || app.IsAvailable() {
			t.Errorf("placeholder app %q should remain unavailable", app.ID)
		}
	}
	if authorization.answers != 0 {
		t.Fatalf("authorization was called %d times for unavailable apps", authorization.answers)
	}
}

func TestCheckAppAccessDeniesUnavailableAppsBeforeResolvingIdentity(t *testing.T) {
	identity := &identityStub{}
	catalog := NewCatalog(Config{}, identity, &authorizationStub{allowed: true})

	if err := catalog.CheckAppAccess(context.Background(), "", "crm"); !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("CheckAppAccess() error = %v, want forbidden", err)
	}
	if identity.calls != 0 {
		t.Fatal("identity lookup should not run for an unavailable app")
	}
}
