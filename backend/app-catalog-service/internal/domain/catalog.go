package domain

import "errors"

var (
	ErrUnauthenticated = errors.New("employee is not authenticated")
	ErrForbidden       = errors.New("app access denied")
)

type App struct {
	ID          string
	Name        string
	Description string
	Href        string
	Initials    string
	Accent      string
	Status      AppStatus
	CanAccess   bool
}

type AppStatus string

const (
	AppStatusAvailable  AppStatus = "available"
	AppStatusComingSoon AppStatus = "coming_soon"
)

// Catalog is the domain collection of applications that may be listed or opened.
type Catalog struct {
	apps []App
}

func NewCatalog(apps []App) *Catalog {
	return &Catalog{apps: append([]App(nil), apps...)}
}

func (c *Catalog) Apps() []App {
	return append([]App(nil), c.apps...)
}

func (c *Catalog) Find(id string) (App, bool) {
	for _, app := range c.apps {
		if app.ID == id {
			return app, true
		}
	}
	return App{}, false
}

func (a App) IsAvailable() bool {
	return a.Status == AppStatusAvailable
}

func (a App) WithAccess(allowed bool) App {
	a.CanAccess = a.IsAvailable() && allowed
	return a
}
