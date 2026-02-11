import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { protocolApi } from '../services/protocol.api';
import type { GenerateProtocolData } from '../services/protocol.api';

export function useProtocols(projectId: string) {
  return useQuery({
    queryKey: ['protocols', projectId],
    queryFn: () => protocolApi.listProtocols(projectId),
    enabled: !!projectId,
  });
}

export function useProtocol(projectId: string, protocolId: string) {
  return useQuery({
    queryKey: ['protocol', projectId, protocolId],
    queryFn: () => protocolApi.getProtocol(projectId, protocolId),
    enabled: !!projectId && !!protocolId,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === 'generating' ? 2000 : false;
    },
  });
}

export function useGenerateProtocol(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GenerateProtocolData) =>
      protocolApi.generateProtocol(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['protocols', projectId] });
    },
  });
}
