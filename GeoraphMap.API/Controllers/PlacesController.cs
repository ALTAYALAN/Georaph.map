using GeoraphMap.Core;
using GeoraphMap.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace GeoraphMap.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class PlacesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PlacesController(AppDbContext context)
        {
            _context = context;
        }
        public class CreatePlaceDto
        {
            public string Name { get; set; } = string.Empty;
            public double Longitude { get; set; }
            public double Latitude { get; set; }
        }

        public class PlaceResponseDto
        {
            public int Id { get; set; }
            public string Name { get; set; } = string.Empty;
            public double Longitude { get; set; }
            public double Latitude { get; set; }
        }

        [HttpGet]
        public async Task<IActionResult> GetPlaces()
        {
            var places = await _context.Places
                .Select(p => new PlaceResponseDto
                {
                    Id = p.Id,
                    Name = p.Name,
                    Longitude = p.Location.X,
                    Latitude = p.Location.Y
                })
                .ToListAsync();

            return Ok(places);
        }

        [HttpPost]
        public async Task<IActionResult> CreatePlace([FromBody] CreatePlaceDto dto)
        {
            var place = new Place
            {
                Name = dto.Name,
                Location = new Point(dto.Longitude, dto.Latitude) { SRID = 4326 }
            };

            _context.Places.Add(place);
            await _context.SaveChangesAsync();

            return Ok(new { 
                Message = "Congratulations! The location coordinates have been successfully entered into the database.", 
                Place = new PlaceResponseDto
                {
                    Id = place.Id,
                    Name = place.Name,
                    Longitude = place.Location.X,
                    Latitude = place.Location.Y
                }
            });
        }
    }
}