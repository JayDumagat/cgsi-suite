package application

import (
	"context"
	"errors"
	"testing"

	"cgsi-suite/services/authorization-service/internal/domain"
)

type openFGAStub struct {
	storeID  string
	modelID  string
	checks   int
	writes   []domain.Tuple
	checkErr error
}

func (stub *openFGAStub) EnsureStore(context.Context, string) (string, error) { return "store-1", nil }
func (stub *openFGAStub) EnsureModel(context.Context, string) (string, error) { return "model-1", nil }
func (stub *openFGAStub) Check(_ context.Context, storeID, modelID string, _ domain.Tuple) (bool, error) {
	stub.storeID, stub.modelID = storeID, modelID
	stub.checks++
	return true, stub.checkErr
}
func (stub *openFGAStub) Write(_ context.Context, storeID, modelID string, tuple domain.Tuple) error {
	stub.storeID, stub.modelID = storeID, modelID
	stub.writes = append(stub.writes, tuple)
	return nil
}

func TestBootstrapPreparesTheStoreAndBaselineRelationships(t *testing.T) {
	openFGA := &openFGAStub{}
	service := NewService(Config{}, openFGA)
	if service.Ready() {
		t.Fatal("service should report unready before bootstrap")
	}
	if err := service.Bootstrap(context.Background()); err != nil {
		t.Fatal(err)
	}
	if !service.Ready() {
		t.Fatal("service should be ready after bootstrap")
	}
	if openFGA.storeID != "store-1" || openFGA.modelID != "model-1" {
		t.Fatalf("bootstrap used store/model %q/%q", openFGA.storeID, openFGA.modelID)
	}
	if len(openFGA.writes) != 2 {
		t.Fatalf("bootstrap wrote %d tuples, want 2", len(openFGA.writes))
	}
}

func TestCheckAndWriteRequireReadyServiceAndValidTuples(t *testing.T) {
	openFGA := &openFGAStub{}
	service := NewService(Config{}, openFGA)
	if _, err := service.Check(context.Background(), domain.Tuple{}); err == nil {
		t.Fatal("check should fail before bootstrap")
	}
	if err := service.Bootstrap(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Check(context.Background(), domain.Tuple{}); err == nil {
		t.Fatal("invalid tuple was checked")
	}
	allowed, err := service.Check(context.Background(), domain.Tuple{User: "user:employee-1", Relation: "viewer", Object: "app:crm"})
	if err != nil || !allowed {
		t.Fatalf("Check() = %v, %v; want true, nil", allowed, err)
	}
}

func TestCheckReturnsOpenFGAErrors(t *testing.T) {
	openFGA := &openFGAStub{checkErr: errors.New("openfga unavailable")}
	service := NewService(Config{}, openFGA)
	if err := service.Bootstrap(context.Background()); err != nil {
		t.Fatal(err)
	}
	_, err := service.Check(context.Background(), domain.Tuple{User: "user:employee-1", Relation: "viewer", Object: "app:crm"})
	if err == nil {
		t.Fatal("expected the OpenFGA error to be returned")
	}
}

func TestTokenAllowedRequiresNonemptyExactToken(t *testing.T) {
	service := NewService(Config{CheckToken: "service-secret", AdminToken: "admin-secret"}, &openFGAStub{})
	if !service.TokenAllowed(CheckTokenKind, "service-secret") {
		t.Fatal("correct service token was rejected")
	}
	if service.TokenAllowed(CheckTokenKind, "") || service.TokenAllowed(CheckTokenKind, "service-secreT") {
		t.Fatal("empty or incorrect service token was accepted")
	}
	if service.TokenAllowed(ProvisioningTokenKind, "service-secret") {
		t.Fatal("a token from another trust boundary was accepted")
	}
	if !service.TokenAllowed(AdminTokenKind, "admin-secret") {
		t.Fatal("correct admin token was rejected")
	}
}
