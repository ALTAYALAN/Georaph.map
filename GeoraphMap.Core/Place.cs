using NetTopologySuite.Geometries;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace GeoraphMap.Core
{
    public class Place
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public Point Location { get; set; }
    }
}
