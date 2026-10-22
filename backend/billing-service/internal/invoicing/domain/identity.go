// Package domain owns the BILS invoicing context. Invoice lifecycle rules and value objects
// belong here; tax, numbering, approval, and posting policies require explicit business decisions.
package domain

import (
	"errors"
	"regexp"
	"strings"
)

var (
	ErrInvalidInvoiceID = errors.New("invalid invoice id")
	idPattern           = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
)

type InvoiceID string

func ParseInvoiceID(value string) (InvoiceID, error) {
	if !idPattern.MatchString(value) {
		return "", ErrInvalidInvoiceID
	}
	return InvoiceID(strings.ToLower(value)), nil
}
