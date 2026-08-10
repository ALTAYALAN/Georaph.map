using GeoraphMap.Core;
using GeoraphMap.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using NetTopologySuite.Geometries;

namespace GeoraphMap.API.Controllers
{
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
            public string Name { get; set; }
            public double Longitude { get; set; }
            public double Latitude { get; set; }
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

            return Ok(new { Message = "Congratulations! The location coordinates have been successfully entered into the database.", PlaceId = place.Id });
        }
    }
}