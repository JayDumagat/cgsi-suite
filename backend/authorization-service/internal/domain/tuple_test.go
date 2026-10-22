package domain

import "testing"

func TestValidTuple(t *testing.T) {
	tests := []struct {
		name  string
		tuple Tuple
		valid bool
	}{
		{name: "employee access", tuple: Tuple{User: "user:employee-1", Relation: "can_access", Object: "app:crm"}, valid: true},
		{name: "group membership", tuple: Tuple{User: "user:123e4567-e89b-12d3-a456-426614174000", Relation: "member", Object: "group:all-employees"}, valid: true},
		{name: "missing user type", tuple: Tuple{User: "employee-1", Relation: "member", Object: "group:all-employees"}},
		{name: "invalid relation", tuple: Tuple{User: "user:employee-1", Relation: "CanAccess", Object: "app:crm"}},
		{name: "missing object type", tuple: Tuple{User: "user:employee-1", Relation: "viewer", Object: "crm"}},
		{name: "empty user identifier", tuple: Tuple{User: "user:", Relation: "viewer", Object: "app:crm"}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := ValidTuple(test.tuple); got != test.valid {
				t.Fatalf("ValidTuple(%+v) = %v, want %v", test.tuple, got, test.valid)
			}
		})
	}
}

func TestOrganizationMembershipValidatesIdentityAndGroup(t *testing.T) {
	const objectID = "123e4567-e89b-12d3-a456-426614174000"
	membership, err := NewEmployeeGroupMembership(objectID, "all-employees")
	if err != nil {
		t.Fatal(err)
	}
	want := (Tuple{User: "user:" + objectID, Relation: "member", Object: "group:all-employees"})
	if got := membership.Relationship(); got != want {
		t.Fatalf("Relationship() = %+v, want %+v", got, want)
	}
	if _, err := NewEmployeeGroupMembership("not-a-uuid", "all-employees"); err == nil {
		t.Fatal("invalid employee object ID was accepted")
	}
	if _, err := NewEmployeeGroupMembership(objectID, "administrators"); err == nil {
		t.Fatal("unexpected group was accepted")
	}
}
