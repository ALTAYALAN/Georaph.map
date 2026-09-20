using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace GeoraphMap.API.Controllers;

public sealed class TransportValidationAttribute : ExceptionFilterAttribute
{
    public override void OnException(ExceptionContext context)
    {
        if (context.Exception is ArgumentException error)
        {
            context.Result = new BadRequestObjectResult(new { message = error.Message });
            context.ExceptionHandled = true;
        }
    }
}
