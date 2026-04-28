-- Bước 1: Khởi tạo lại Database hoàn toàn mới
CREATE DATABASE XuanPhuGold;
GO

-- Bước 2: Báo cho SQL Server biết chúng ta sẽ thao tác trên Database vừa tạo
USE XuanPhuGold;
GO

-- Bước 3: Tạo bảng lưu trữ Sản Phẩm (Products)
CREATE TABLE Products (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(255) NOT NULL,
    ImageUrl NVARCHAR(MAX) NOT NULL,
    Category NVARCHAR(50) DEFAULT N'Phổ biến'
);
go

CREATE TABLE Invoices (
    InvoiceId       INT IDENTITY(1,1) PRIMARY KEY,
    InvoiceCode     NVARCHAR(20) NOT NULL UNIQUE,           -- VD: HD20260408001
    
    SaleDate        DATETIME DEFAULT GETDATE(),
    CustomerName    NVARCHAR(150) NULL,                     -- Tên khách (có thể để trống)
    CustomerPhone   NVARCHAR(20) NULL,                      -- Số điện thoại khách
    
    TotalAmount     DECIMAL(18,2) NOT NULL DEFAULT 0,       -- Tổng tiền trước giảm giá
    Discount        DECIMAL(18,2) DEFAULT 0,                -- Giảm giá
    FinalAmount     DECIMAL(18,2) NOT NULL DEFAULT 0,       -- Thành tiền cuối cùng
    
    PaymentMethod   NVARCHAR(50) DEFAULT N'Tiền mặt',
    Status          NVARCHAR(30) DEFAULT N'Hoàn thành',
    Notes           NVARCHAR(500) NULL,
    
    CreatedBy       NVARCHAR(100) NULL,                     -- Tài khoản admin tạo hóa đơn
    CreatedAt       DATETIME DEFAULT GETDATE()
);
GO

-- 2. Bảng Chi tiết hóa đơn (InvoiceDetails)
CREATE TABLE InvoiceDetails (
    DetailId    INT IDENTITY(1,1) PRIMARY KEY,
    InvoiceId   INT NOT NULL,
    ProductId   INT NOT NULL,
    
    Quantity    INT NOT NULL DEFAULT 1,
    UnitPrice   DECIMAL(18,2) NOT NULL,      -- Giá bán tại thời điểm lập hóa đơn
    Subtotal    DECIMAL(18,2) NOT NULL,      -- Quantity × UnitPrice
    
    FOREIGN KEY (InvoiceId) REFERENCES Invoices(InvoiceId) ON DELETE CASCADE,
    FOREIGN KEY (ProductId) REFERENCES Products(Id)
);
GO
-- Bảng Users
-- Tai khoan khach hang dung truc tiep cho FE/Admin cua main project.
CREATE TABLE dbo.Users (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(50) NOT NULL UNIQUE,
    email NVARCHAR(254) NULL UNIQUE,
    password_hash NVARCHAR(256) NOT NULL,
    password_salt NVARCHAR(128) NULL,
    created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    is_active BIT NOT NULL DEFAULT 1,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    last_login_at DATETIMEOFFSET NULL,
    lockout_until DATETIMEOFFSET NULL
);

-- Bảng UserProfile (one-to-one với Users)
CREATE TABLE dbo.UserProfiles (
    id BIGINT NOT NULL PRIMARY KEY,
    full_name NVARCHAR(200) NULL,
    phone_number NVARCHAR(50) NULL,
    address NVARCHAR(500) NULL,
    avatar_url NVARCHAR(1000) NULL,
    date_of_birth DATE NULL,
    gender NVARCHAR(20) NULL,
    additional_json NVARCHAR(MAX) NULL,
    CONSTRAINT FK_UserProfiles_Users FOREIGN KEY (id) REFERENCES dbo.Users(id) ON DELETE CASCADE
);

-- Tùy chọn: Bảng Roles
CREATE TABLE dbo.Roles (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    role_name NVARCHAR(50) NOT NULL UNIQUE,
    description NVARCHAR(255) NULL,
    created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

-- Tùy chọn: Bảng UserRoles (nhiều-nhiều giữa Users và Roles)
CREATE TABLE dbo.UserRoles (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    assigned_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT FK_UserRoles_Users FOREIGN KEY (user_id) REFERENCES dbo.Users(id) ON DELETE CASCADE,
    CONSTRAINT FK_UserRoles_Roles FOREIGN KEY (role_id) REFERENCES dbo.Roles(id) ON DELETE CASCADE
);
GO
