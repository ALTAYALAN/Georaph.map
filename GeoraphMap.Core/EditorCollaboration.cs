using System;

namespace GeoraphMap.Core
{
    public class EditorCollaboration
    {
        public int Id { get; set; }
        public int SenderUserId { get; set; }
        public User? SenderUser { get; set; }
        public int ReceiverUserId { get; set; }
        public User? ReceiverUser { get; set; }
        public string Status { get; set; } = "Pending"; // Pending, Approved, Rejected
        public DateTime RequestedDate { get; set; } = DateTime.UtcNow;
        public DateTime? RespondedDate { get; set; }
    }
}
