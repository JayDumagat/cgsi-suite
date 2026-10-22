package domain

import "testing"

func TestWithAccessRequiresAnAvailableApp(t *testing.T) {
	available := App{ID: "cube", Status: AppStatusAvailable}
	if app := available.WithAccess(true); !app.CanAccess {
		t.Fatal("available app should allow the granted access")
	}

	comingSoon := App{ID: "cdex", Status: AppStatusComingSoon}
	if app := comingSoon.WithAccess(true); app.CanAccess {
		t.Fatal("coming-soon app must not become accessible")
	}
}

func TestCatalogReturnsCopiesOfItsAppCollection(t *testing.T) {
	catalog := NewCatalog([]App{{ID: "cube", Name: "Cube"}})

	apps := catalog.Apps()
	apps[0].Name = "changed"
	if got := catalog.Apps()[0].Name; got != "Cube" {
		t.Fatalf("catalog collection was mutated: got %q", got)
	}
}
