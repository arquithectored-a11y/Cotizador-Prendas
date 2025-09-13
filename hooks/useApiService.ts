import { useCallback } from 'react';
import { apiService } from '../services/apiService';
import { useAppContext } from '../context/AppContext';
import { ItemKey, AnyItem, CatalogItem } from '../types';

export const useApiService = () => {
    const { userRole } = useAppContext();

    const saveItem = useCallback(<T extends {id: string}>(key: ItemKey, item: T) => {
        return apiService.saveItem(key, item, userRole);
    }, [userRole]);

    const deleteItem = useCallback((key: ItemKey, id: string) => {
        return apiService.deleteItem(key, id, userRole);
    }, [userRole]);

    const addStock = useCallback((itemId: string, amountToAdd: number) => {
        return apiService.addStock(itemId, amountToAdd, userRole);
    }, [userRole]);

    return { saveItem, deleteItem, addStock };
}