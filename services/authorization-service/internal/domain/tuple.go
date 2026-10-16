package domain

import "regexp"

import "errors"

var (
	tupleUserPart        = regexp.MustCompile(`^[a-z][a-z0-9_-]*:[A-Za-z0-9][A-Za-z0-9._@/-]*(#[a-z][a-z0-9_]*)?$`)
	tupleObjectPart      = regexp.MustCompile(`^[a-z][a-z0-9_-]*:[A-Za-z0-9][A-Za-z0-9._@/-]*$`)
	relationPart         = regexp.MustCompile(`^[a-z][a-z0-9_]*$`)
	organizationObjectID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
)

var ErrInvalidEmployeeGroupMembership = errors.New("invalid employee group membership")

type Tuple struct {
	User     string
	Relation string
	Object   string
}

func ValidTuple(tuple Tuple) bool {
	return tupleUserPart.MatchString(tuple.User) && tupleObjectPart.MatchString(tuple.Object) &&
		len(tuple.Relation) <= 64 && relationPart.MatchString(tuple.Relation)
}

func ValidOrganizationObjectID(value string) bool {
	return organizationObjectID.MatchString(value)
}

// EmployeeGroupMembership is a domain relationship between an Entra employee and a CGSI group.
type EmployeeGroupMembership struct {
	objectID string
	groupKey string
}

func NewEmployeeGroupMembership(objectID, groupKey string) (EmployeeGroupMembership, error) {
	if !ValidOrganizationObjectID(objectID) || groupKey != "all-employees" {
		return EmployeeGroupMembership{}, ErrInvalidEmployeeGroupMembership
	}
	return EmployeeGroupMembership{objectID: objectID, groupKey: groupKey}, nil
}

func (membership EmployeeGroupMembership) Relationship() Tuple {
	return Tuple{
		User:     "user:" + membership.objectID,
		Relation: "member",
		Object:   "group:" + membership.groupKey,
	}
}
