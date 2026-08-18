using GeoraphMap.Core;
using GeoraphMap.Core.DTOs;
using GeoraphMap.Core.Services;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace GeoraphMap.Infrastructure.Services
{
    public class CollaborationService : ICollaborationService
    {
        private readonly AppDbContext _context;

        public CollaborationService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<EditorUserDto>> GetAvailableEditorsAsync(int currentUserId)
        {
            return await _context.Users
                .Where(u => u.Id != currentUserId && u.IsActive && !u.IsDeleted)
                .Select(u => new EditorUserDto
                {
                    Id = u.Id,
                    Username = u.Username,
                    Email = u.Email
                })
                .ToListAsync();
        }

        public async Task<CollaborationResponseDto> SendRequestAsync(int senderUserId, int receiverUserId)
        {
            if (senderUserId == receiverUserId)
            {
                throw new ArgumentException("Kendinize işbirliği isteği gönderemezsiniz.");
            }

            var receiverUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == receiverUserId && u.IsActive && !u.IsDeleted);
            if (receiverUser == null)
            {
                throw new ArgumentException("Hedef editör bulunamadı.");
            }

            var existing = await _context.EditorCollaborations
                .FirstOrDefaultAsync(c =>
                    (c.SenderUserId == senderUserId && c.ReceiverUserId == receiverUserId) ||
                    (c.SenderUserId == receiverUserId && c.ReceiverUserId == senderUserId));

            if (existing != null)
            {
                if (existing.Status == "Approved")
                {
                    throw new InvalidOperationException("Bu editör ile zaten aktif bir işbirliğiniz bulunmaktadır.");
                }
                if (existing.Status == "Pending")
                {
                    throw new InvalidOperationException("Bu editör ile gönderilmiş onay bekleyen bir isteğiniz zaten var.");
                }

                existing.SenderUserId = senderUserId;
                existing.ReceiverUserId = receiverUserId;
                existing.Status = "Pending";
                existing.RequestedDate = DateTime.UtcNow;
                existing.RespondedDate = null;
                await _context.SaveChangesAsync();

                var senderUserObj = await _context.Users.FindAsync(senderUserId);
                return new CollaborationResponseDto
                {
                    Id = existing.Id,
                    SenderUserId = senderUserId,
                    SenderUsername = senderUserObj?.Username ?? "Editor",
                    ReceiverUserId = receiverUserId,
                    ReceiverUsername = receiverUser.Username,
                    Status = existing.Status,
                    RequestedDate = existing.RequestedDate
                };
            }

            var newCollab = new EditorCollaboration
            {
                SenderUserId = senderUserId,
                ReceiverUserId = receiverUserId,
                Status = "Pending",
                RequestedDate = DateTime.UtcNow
            };

            _context.EditorCollaborations.Add(newCollab);
            await _context.SaveChangesAsync();

            var senderUser = await _context.Users.FindAsync(senderUserId);
            return new CollaborationResponseDto
            {
                Id = newCollab.Id,
                SenderUserId = senderUserId,
                SenderUsername = senderUser?.Username ?? "Editor",
                ReceiverUserId = receiverUserId,
                ReceiverUsername = receiverUser.Username,
                Status = newCollab.Status,
                RequestedDate = newCollab.RequestedDate
            };
        }

        public async Task<bool> RespondRequestAsync(int receiverUserId, int requestId, bool approve)
        {
            var collab = await _context.EditorCollaborations.FirstOrDefaultAsync(c => c.Id == requestId && c.ReceiverUserId == receiverUserId);
            if (collab == null)
            {
                throw new ArgumentException("İstek bulunamadı veya bu isteği yanıtlama yetkiniz yok.");
            }

            collab.Status = approve ? "Approved" : "Rejected";
            collab.RespondedDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> CancelCollaborationAsync(int userId, int requestId)
        {
            var collab = await _context.EditorCollaborations.FirstOrDefaultAsync(c =>
                c.Id == requestId && (c.SenderUserId == userId || c.ReceiverUserId == userId));

            if (collab == null)
            {
                throw new ArgumentException("İşbirliği kaydı bulunamadı veya bu işlemi yapma yetkiniz yok.");
            }

            _context.EditorCollaborations.Remove(collab);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<List<CollaborationResponseDto>> GetMyRequestsAsync(int userId)
        {
            var collabs = await _context.EditorCollaborations
                .Include(c => c.SenderUser)
                .Include(c => c.ReceiverUser)
                .Where(c => c.SenderUserId == userId || c.ReceiverUserId == userId)
                .OrderByDescending(c => c.RequestedDate)
                .ToListAsync();

            return collabs.Select(c => new CollaborationResponseDto
            {
                Id = c.Id,
                SenderUserId = c.SenderUserId,
                SenderUsername = c.SenderUser?.Username ?? $"Kullanıcı #{c.SenderUserId}",
                ReceiverUserId = c.ReceiverUserId,
                ReceiverUsername = c.ReceiverUser?.Username ?? $"Kullanıcı #{c.ReceiverUserId}",
                Status = c.Status,
                RequestedDate = c.RequestedDate
            }).ToList();
        }

        public async Task<List<int>> GetApprovedCollaboratorUserIdsAsync(int userId)
        {
            var senderCollabs = await _context.EditorCollaborations
                .Where(c => c.Status == "Approved" && c.SenderUserId == userId)
                .Select(c => c.ReceiverUserId)
                .ToListAsync();

            var receiverCollabs = await _context.EditorCollaborations
                .Where(c => c.Status == "Approved" && c.ReceiverUserId == userId)
                .Select(c => c.SenderUserId)
                .ToListAsync();

            var result = new HashSet<int>(senderCollabs);
            foreach (var id in receiverCollabs) result.Add(id);
            return result.ToList();
        }
    }
}
