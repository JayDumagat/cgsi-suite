package application

import "context"

func (s *Service) Bootstrap(ctx context.Context) error {
	storeID, err := s.openFGA.EnsureStore(ctx, storeName)
	if err != nil {
		return err
	}
	modelID, err := s.openFGA.EnsureModel(ctx, storeID)
	if err != nil {
		return err
	}
	s.storeID = storeID
	s.modelID = modelID
	if err := s.openFGA.Write(ctx, storeID, modelID, domainAllEmployeesOrganizationTuple()); err != nil {
		return err
	}
	if err := s.openFGA.Write(ctx, storeID, modelID, domainCubeAccessTuple()); err != nil {
		return err
	}
	return nil
}
