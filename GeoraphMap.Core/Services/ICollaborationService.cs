using GeoraphMap.Core.DTOs;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace GeoraphMap.Core.Services
{
    public interface ICollaborationService
    {
        Task<List<EditorUserDto>> GetAvailableEditorsAsync(int currentUserId);
        Task<CollaborationResponseDto> SendRequestAsync(int senderUserId, int receiverUserId);
        Task<bool> RespondRequestAsync(int receiverUserId, int requestId, bool approve);
        Task<bool> CancelCollaborationAsync(int userId, int requestId);
        Task<List<CollaborationResponseDto>> GetMyRequestsAsync(int userId);
        Task<List<int>> GetApprovedCollaboratorUserIdsAsync(int userId);
        Task<EffectiveSpatialBoundaryDto> GetEffectiveSpatialBoundaryInfoAsync(int userId);
    }
}
