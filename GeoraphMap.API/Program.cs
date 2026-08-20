using GeoraphMap.Core.Services;
using GeoraphMap.Infrastructure;
using GeoraphMap.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        x => x.UseNetTopologySuite()
    ));

// Custom Application Services (N-Tier Architecture)
builder.Services.AddScoped<IDrawingService, DrawingService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IAnalysisService, AnalysisService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IRoleService, RoleService>();
builder.Services.AddHttpClient();
builder.Services.AddScoped<IPermissionService, PermissionService>();
builder.Services.AddScoped<ICollaborationService, CollaborationService>();
builder.Services.AddScoped<ICityService, CityService>();
builder.Services.AddScoped<IGeoServerService, GeoServerService>();

// JWT Authentication Configuration
var jwtKey = builder.Configuration["Jwt:Key"] ?? "GeoMap_Super_Secret_Key_For_Jwt_Authentication_2026_Key!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "GeoMapAPI";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "GeoMapClient";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = false, // Infinite session lifetime - Admin & User sessions never expire
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Otomatik Veritabanı Migrasyonunu Uygula ve Seed Verilerini İşle
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    dbContext.Database.Migrate();
    DbSeeder.EnsureTablesCreatedAsync(dbContext).GetAwaiter().GetResult();
    DbSeeder.SeedAsdfUserAndAssignDrawingsAsync(dbContext).GetAwaiter().GetResult();
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseStaticFiles();
app.UseCors("AllowAll");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapFallbackToFile("index.html");

app.Run();
