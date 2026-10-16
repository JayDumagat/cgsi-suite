// Package domain owns identities shared by the CDEX customer relationship context.
// Customer profile fields and lifecycle rules belong here once their business meaning is agreed.
package domain

import (
	"errors"
	"regexp"
	"strings"
)

var (
	ErrInvalidCustomerID      = errors.New("invalid customer id")
	ErrInvalidAccountID       = errors.New("invalid account id")
	ErrInvalidSalesActivityID = errors.New("invalid sales activity id")
	idPattern                 = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
)

type CustomerID string
type AccountID string
type SalesActivityID string

func ParseCustomerID(value string) (CustomerID, error) {
	if !idPattern.MatchString(value) {
		return "", ErrInvalidCustomerID
	}
	return CustomerID(strings.ToLower(value)), nil
}

func ParseAccountID(value string) (AccountID, error) {
	if !idPattern.MatchString(value) {
		return "", ErrInvalidAccountID
	}
	return AccountID(strings.ToLower(value)), nil
}

func ParseSalesActivityID(value string) (SalesActivityID, error) {
	if !idPattern.MatchString(value) {
		return "", ErrInvalidSalesActivityID
	}
	return SalesActivityID(strings.ToLower(value)), nil
}
