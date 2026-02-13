import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { protocolSigningApi } from '../services/protocolSigning.api';

export function useProtocolSignatures(projectId: string, protocolId: string) {
  return useQuery({
    queryKey: ['protocol-signatures', projectId, protocolId],
    queryFn: () => protocolSigningApi.getSignatures(projectId, protocolId),
    enabled: !!projectId && !!protocolId,
  });
}

export function useCreateSigningLink(projectId: string, protocolId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email?: string) =>
      protocolSigningApi.createSigningLink(projectId, protocolId, email),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['protocol-signatures', projectId, protocolId],
      });
    },
  });
}

export function usePublicSigningInfo(token: string) {
  return useQuery({
    queryKey: ['public-signing', token],
    queryFn: () => protocolSigningApi.getPublicSigningInfo(token),
    enabled: !!token,
    retry: false,
  });
}

export function useSubmitSignature(token: string) {
  return useMutation({
    mutationFn: (data: { signerName: string; signerEmail: string; signatureData: string }) =>
      protocolSigningApi.submitPublicSignature(token, data),
  });
}
