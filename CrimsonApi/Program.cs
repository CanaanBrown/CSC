using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using MySqlConnector;
using Dapper;
using BCrypt.Net;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// DB connection
builder.Services.AddScoped<MySqlConnection>(_ =>
{
    var cs = builder.Configuration.GetConnectionString("Db");
    return new MySqlConnection(cs);
});

// CORS for local testing (Live Server → API)
builder.Services.AddCors(options =>
{
    options.AddPolicy("DevAll", p =>
        p.AllowAnyOrigin()
         .AllowAnyHeader()
         .AllowAnyMethod());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("DevAll");
// To serve wwwroot from API later, uncomment:
// app.UseDefaultFiles();
// app.UseStaticFiles();

app.UseHttpsRedirection();

// -------------------- Authentication Endpoints --------------------

// Sign up
app.MapPost("/api/auth/signup", async (MySqlConnection db, SignupRequest req) =>
{
    try
    {
        await db.OpenAsync();
        
        // Check if email already exists
        var existing = await db.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT user_id FROM users WHERE email = @email",
            new { email = req.Email }
        );
        
        if (existing != null)
        {
            await db.CloseAsync();
            return Results.BadRequest(new { message = "Email already registered" });
        }
        
        // Hash password
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(req.Password);
        
        // Insert user
        const string sql = @"INSERT INTO users (name, email, password_hash)
                             VALUES (@name, @email, @passwordHash);
                             SELECT LAST_INSERT_ID();";
        
        var userId = await db.ExecuteScalarAsync<long>(sql, new
        {
            name = req.Name,
            email = req.Email,
            passwordHash
        });
        
        await db.CloseAsync();
        
        // Generate simple token (in production, use JWT)
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        
        return Results.Ok(new
        {
            token,
            user = new { userId, name = req.Name, email = req.Email }
        });
    }
    catch (Exception ex)
    {
        if (db.State == System.Data.ConnectionState.Open)
        {
            await db.CloseAsync();
        }
        return Results.Problem(
            detail: ex.Message,
            statusCode: 500,
            title: "Signup failed"
        );
    }
});

// Login
app.MapPost("/api/auth/login", async (MySqlConnection db, LoginRequest req) =>
{
    try
    {
        await db.OpenAsync();
        
        var user = await db.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT user_id, name, email, password_hash FROM users WHERE email = @email",
            new { email = req.Email }
        );
        
        if (user == null)
        {
            await db.CloseAsync();
            return Results.Unauthorized();
        }
        
        // Verify password
        if (!BCrypt.Net.BCrypt.Verify(req.Password, user.password_hash))
        {
            await db.CloseAsync();
            return Results.Unauthorized();
        }
        
        // Update last login
        await db.ExecuteAsync(
            "UPDATE users SET last_login = NOW() WHERE user_id = @userId",
            new { userId = user.user_id }
        );
        
        await db.CloseAsync();
        
        // Generate simple token (in production, use JWT)
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        
        return Results.Ok(new
        {
            token,
            user = new { userId = user.user_id, name = user.name, email = user.email }
        });
    }
    catch (Exception ex)
    {
        if (db.State == System.Data.ConnectionState.Open)
        {
            await db.CloseAsync();
        }
        return Results.Problem(
            detail: ex.Message,
            statusCode: 500,
            title: "Login failed"
        );
    }
});

// Check auth (simple token check)
app.MapGet("/api/auth/check", async (HttpRequest req) =>
{
    var token = req.Headers["Authorization"].ToString().Replace("Bearer ", "");
    if (string.IsNullOrEmpty(token))
    {
        return Results.Unauthorized();
    }
    // In production, validate JWT token properly
    return Results.Ok(new { authenticated = true });
});

// -------------------- Endpoints --------------------

app.MapGet("/api/products", async (MySqlConnection db) =>
{
    const string sql = @"SELECT product_id, name, category, sport, unit_price, stock_qty, active
                         FROM products
                         WHERE active=1
                         ORDER BY name;";
    await db.OpenAsync();
    var rows = await db.QueryAsync(sql);
    await db.CloseAsync();
    return Results.Ok(rows);
});

app.MapGet("/api/orders", async (MySqlConnection db) =>
{
    const string sql = @"SELECT t.transaction_id,
                                t.transaction_date,
                                c.first_name,
                                c.last_name,
                                e.first_name  AS emp_first_name,
                                e.last_name   AS emp_last_name,
                                t.subtotal,
                                t.tax,
                                t.total
                         FROM customer_purchase_transactions t
                         JOIN customers c ON c.customer_id = t.customer_id
                         JOIN employees e ON e.employee_id = t.employee_id
                         ORDER BY t.transaction_id DESC
                         LIMIT 100;";
    await db.OpenAsync();
    var rows = await db.QueryAsync(sql);
    await db.CloseAsync();
    return Results.Ok(rows);
});

// Order details for drawer
app.MapGet("/api/orders/{id:long}", async (MySqlConnection db, long id) =>
{
    const string hdr = @"SELECT t.transaction_id,
                                t.transaction_date,
                                c.first_name,
                                c.last_name,
                                e.first_name  AS emp_first_name,
                                e.last_name   AS emp_last_name,
                                t.subtotal, t.tax, t.total
                         FROM customer_purchase_transactions t
                         JOIN customers c ON c.customer_id = t.customer_id
                         JOIN employees e ON e.employee_id = t.employee_id
                         WHERE t.transaction_id=@id;";
    const string lines = @"SELECT d.line_no,
                                  d.qty,
                                  d.unit_price,
                                  d.line_total,
                                  p.product_id,
                                  p.name
                           FROM transaction_details d
                           JOIN products p ON p.product_id = d.product_id
                           WHERE d.transaction_id=@id
                           ORDER BY d.line_no;";

    await db.OpenAsync();
    var header = await db.QueryFirstOrDefaultAsync(hdr, new { id });
    var detail = await db.QueryAsync(lines, new { id });
    await db.CloseAsync();

    if (header is null) return Results.NotFound();
    return Results.Ok(new { header, lines = detail });
});

app.MapPost("/api/transactions", async (MySqlConnection db, TransactionRequest req, IConfiguration cfg) =>
{
    await db.OpenAsync();
    await using var tx = await db.BeginTransactionAsync();

    const string insertHeader = @"INSERT INTO customer_purchase_transactions(customer_id, employee_id, subtotal, tax, total)
                                  VALUES (@customerId, @employeeId, 0, 0, 0);
                                  SELECT LAST_INSERT_ID();";

    var transactionId = await db.ExecuteScalarAsync<long>(
        insertHeader,
        new { customerId = req.CustomerId, employeeId = req.EmployeeId },
        tx
    );

    const string insertLine = @"INSERT INTO transaction_details(transaction_id, line_no, product_id, qty, unit_price, line_total)
                                VALUES (@tid, @line, @pid, @qty, @price, 0);";

    var lineNo = 1;
    foreach (var line in req.Lines)
    {
        await db.ExecuteAsync(
            insertLine,
            new { tid = transactionId, line = lineNo++, pid = line.ProductId, qty = line.Qty, price = line.UnitPrice },
            tx
        );
    }

    var subtotal = await db.ExecuteScalarAsync<decimal>(
        "SELECT IFNULL(SUM(line_total),0) FROM transaction_details WHERE transaction_id=@tid",
        new { tid = transactionId },
        tx
    );

    var taxRate = cfg.GetValue<decimal>("TaxRate");
    var tax = Math.Round(subtotal * taxRate, 2);
    var total = subtotal + tax;

    await db.ExecuteAsync(
        @"UPDATE customer_purchase_transactions
          SET subtotal=@sub, tax=@tax, total=@tot
          WHERE transaction_id=@tid",
        new { sub = subtotal, tax, tot = total, tid = transactionId },
        tx
    );

    await tx.CommitAsync();
    await db.CloseAsync();

    return Results.Created($"/api/transactions/{transactionId}", new { transactionId, subtotal, tax, total });
});

// --------- Reports ---------
app.MapGet("/api/reports/top-products", async (MySqlConnection db) =>
{
    const string sql = @"SELECT p.product_id,
                                p.name,
                                SUM(td.qty)        AS units_sold,
                                SUM(td.line_total) AS revenue
                         FROM transaction_details td
                         JOIN products p ON p.product_id = td.product_id
                         GROUP BY p.product_id, p.name
                         ORDER BY revenue DESC
                         LIMIT 5;";
    await db.OpenAsync();
    var rows = await db.QueryAsync(sql);
    await db.CloseAsync();
    return Results.Ok(rows);
});

app.MapGet("/api/reports/low-stock", async (MySqlConnection db) =>
{
    const string sql = @"SELECT product_id, name, stock_qty
                         FROM products
                         WHERE active=1 AND stock_qty<=5
                         ORDER BY stock_qty, name;";
    await db.OpenAsync();
    var rows = await db.QueryAsync(sql);
    await db.CloseAsync();
    return Results.Ok(rows);
});

app.MapGet("/api/reports/revenue-by-month", async (MySqlConnection db) =>
{
    const string sql = @"SELECT DATE_FORMAT(transaction_date,'%Y-%m') AS month,
                                SUM(total) AS revenue,
                                COUNT(*)   AS orders
                         FROM customer_purchase_transactions
                         GROUP BY month
                         ORDER BY month;";
    await db.OpenAsync();
    var rows = await db.QueryAsync(sql);
    await db.CloseAsync();
    return Results.Ok(rows);
});

// NEW: Employee stats (orders + revenue by employee)
app.MapGet("/api/reports/employee-stats", async (MySqlConnection db) =>
{
    const string sql = @"SELECT e.employee_id,
                                e.first_name,
                                e.last_name,
                                COUNT(t.transaction_id) AS orders,
                                IFNULL(SUM(t.total),0)  AS revenue
                         FROM employees e
                         LEFT JOIN customer_purchase_transactions t
                           ON t.employee_id = e.employee_id
                         GROUP BY e.employee_id, e.first_name, e.last_name
                         ORDER BY revenue DESC, orders DESC;";
    await db.OpenAsync();
    var rows = await db.QueryAsync(sql);
    await db.CloseAsync();
    return Results.Ok(rows);
});

// --------- Dropdowns for New Order ---------
app.MapGet("/api/customers", async (MySqlConnection db) =>
{
    const string sql = @"SELECT customer_id, first_name, last_name, email, phone
                         FROM customers
                         ORDER BY last_name, first_name;";
    await db.OpenAsync();
    var rows = await db.QueryAsync(sql);
    await db.CloseAsync();
    return Results.Ok(rows);
});

app.MapGet("/api/employees", async (MySqlConnection db) =>
{
    const string sql = @"SELECT employee_id, first_name, last_name, role, hire_date
                         FROM employees
                         ORDER BY last_name, first_name;";
    await db.OpenAsync();
    var rows = await db.QueryAsync(sql);
    await db.CloseAsync();
    return Results.Ok(rows);
});

// --------- Stock adjustment (admin-lite) ---------
// Body: { "delta": 5 } or { "delta": -3 }
app.MapPost("/api/products/{id:long}/adjust-stock", async (MySqlConnection db, long id, StockAdjust body) =>
{
    const string sql = @"UPDATE products
                         SET stock_qty = GREATEST(0, stock_qty + @delta)
                         WHERE product_id = @id;";
    await db.OpenAsync();
    var rows = await db.ExecuteAsync(sql, new { id, delta = body.Delta });
    await db.CloseAsync();
    if (rows == 0) return Results.NotFound(new { message = "Product not found" });
    return Results.Ok(new { productId = id, delta = body.Delta });
});

app.Run();

// -------------------- Models --------------------
public class TransactionRequest
{
    public long CustomerId { get; set; }
    public long EmployeeId { get; set; }
    public List<TransactionLine> Lines { get; set; } = new();
}

public class TransactionLine
{
    public long ProductId { get; set; }
    public int Qty { get; set; }
    public decimal UnitPrice { get; set; }
}

public class StockAdjust
{
    public int Delta { get; set; }
}

public class SignupRequest
{
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
}

public class LoginRequest
{
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
    public bool RememberMe { get; set; }
}
