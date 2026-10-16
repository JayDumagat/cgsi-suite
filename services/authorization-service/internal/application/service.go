package application

import (
	"context"
	"crypto/subtle"
	"errors"

	"cgsi-suite/services/authorization-service/internal/domain"
)

const storeName = "CGSI Suite"

type TokenKind int

const (
	CheckTokenKind TokenKind = iota
	ProvisioningTokenKind
	AdminTokenKind
)

type OpenFGA interface {
	EnsureStore(context.Context, string) (string, error)
	EnsureModel(context.Context, string) (string, error)
	Check(context.Context, string, string, domain.Tuple) (bool, error)
	Write(context.Context, string, string, domain.Tuple) error
}

type Config struct {
	CheckToken        string
	ProvisioningToken string
	AdminToken        string
}

type Service struct {
	openFGA           OpenFGA
	checkToken        string
	provisioningToken string
	adminToken        string
	storeID           string
	modelID           string
}

func NewService(config Config, openFGA OpenFGA) *Service {
	return &Service{
		openFGA:           openFGA,
		checkToken:        config.CheckToken,
		provisioningToken: config.ProvisioningToken,
		adminToken:        config.AdminToken,
	}
}

func (s *Service) Ready() bool {
	return s.storeID != "" && s.modelID != ""
}

func (s *Service) Check(ctx context.Context, tuple domain.Tuple) (bool, error) {
	if !s.Ready() || !domain.ValidTuple(tuple) {
		return false, errors.New("authorization service is not ready or tuple is invalid")
	}
	return s.openFGA.Check(ctx, s.storeID, s.modelID, tuple)
}

func (s *Service) AddOrganizationMember(ctx context.Context, objectID, groupKey string) error {
	membership, err := domain.NewEmployeeGroupMembership(objectID, groupKey)
	if err != nil {
		return err
	}
	return s.WriteRelationship(ctx, membership.Relationship())
}

func (s *Service) WriteRelationship(ctx context.Context, tuple domain.Tuple) error {
	if !s.Ready() || !domain.ValidTuple(tuple) {
		return errors.New("authorization service is not ready or tuple is invalid")
	}
	return s.openFGA.Write(ctx, s.storeID, s.modelID, tuple)
}

func (s *Service) TokenAllowed(kind TokenKind, provided string) bool {
	var expected string
	switch kind {
	case CheckTokenKind:
		expected = s.checkToken
	case ProvisioningTokenKind:
		expected = s.provisioningToken
	case AdminTokenKind:
		expected = s.adminToken
	default:
		return false
	}
	return expected != "" && len(expected) == len(provided) && subtle.ConstantTimeCompare([]byte(expected), []byte(provided)) == 1
}
