package application

import "cgsi-suite/services/authorization-service/internal/domain"

func domainCubeAccessTuple() domain.Tuple {
	return domain.Tuple{User: "organization:cgsi#member", Relation: "viewer", Object: "app:cube"}
}

func domainAllEmployeesOrganizationTuple() domain.Tuple {
	return domain.Tuple{User: "group:all-employees#member", Relation: "member", Object: "organization:cgsi"}
}
