/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock bcrypt module
jest.mock('bcrypt');

type HashMock = jest.Mock<Promise<string>, [string, number]>;
type CompareMock = jest.Mock<Promise<boolean>, [string, string]>;

const mockBcrypt = {
  hash: jest.fn() as HashMock,
  compare: jest.fn() as CompareMock,
};

// ---- Helpers: fake data ----
const fakeUser = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@stemverse.com',
  passwordHash: '$2b$12$hashedPasswordValue',
  role: 'consumer',
  displayName: 'Test User',
  avatarUrl: null,
  bio: null,
  isVerified: false,
  isBanned: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockJwtService = {
  sign: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: typeof mockPrismaService;
  let jwt: typeof mockJwtService;

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwt = module.get(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ================================================================
  // 🔴 RED: Register — describe expected behavior
  // ================================================================
  describe('register', () => {
    const registerDto = {
      email: 'new@stemverse.com',
      password: 'SecureP@ss123',
      displayName: 'New Artist',
    };

    it('should hash the password with bcrypt (cost 12) and create user', async () => {
      // Arrange
      const hashedPw = '$2b$12$newlyHashedValue';
      mockBcrypt.hash.mockResolvedValue(hashedPw);
      prisma.user.findUnique.mockResolvedValue(null); // email not taken
      prisma.user.create.mockResolvedValue({
        ...fakeUser,
        email: registerDto.email,
        passwordHash: hashedPw,
        displayName: registerDto.displayName,
      });
      jwt.sign.mockReturnValue('jwt_access_token_mock');

      // Act
      const result = await service.register(registerDto);

      // Assert — password was hashed with cost 12
      expect(mockBcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);

      // Assert — Prisma create was called with hashed password
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: registerDto.email,
          passwordHash: hashedPw,
          displayName: registerDto.displayName,
          role: 'consumer',
        },
      });

      // Assert — returns access_token and user (without passwordHash)
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('user');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user.email).toBe(registerDto.email);
    });

    it('should throw ConflictException when email already exists', async () => {
      // Arrange — email already taken
      prisma.user.findUnique.mockResolvedValue(fakeUser);

      // Act & Assert
      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        'Email already registered',
      );

      // Assert — should NOT create user
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should default role to consumer when not specified', async () => {
      // Arrange
      mockBcrypt.hash.mockResolvedValue('$2b$12$hash');
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        ...fakeUser,
        email: registerDto.email,
      });
      jwt.sign.mockReturnValue('token');

      // Act
      await service.register({ email: 'a@b.com', password: 'Test1234!' });

      // Assert
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'consumer' }),
        }),
      );
    });
  });

  // ================================================================
  // 🔴 RED: Login — describe expected behavior
  // ================================================================
  describe('login', () => {
    const loginDto = {
      email: 'test@stemverse.com',
      password: 'SecureP@ss123',
    };

    it('should return access_token and user on valid credentials', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(fakeUser);
      mockBcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('jwt_access_token_login');

      // Act
      const result = await service.login(loginDto);

      // Assert
      expect(result).toHaveProperty('access_token', 'jwt_access_token_login');
      expect(result).toHaveProperty('user');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user.email).toBe(loginDto.email);
    });

    it('should call jwt.sign with correct payload (id, email, role)', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(fakeUser);
      mockBcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('token');

      // Act
      await service.login(loginDto);

      // Assert
      expect(jwt.sign).toHaveBeenCalledWith({
        sub: fakeUser.id,
        email: fakeUser.email,
        role: fakeUser.role,
      });
    });

    it('should throw UnauthorizedException when email not found', async () => {
      // Arrange — no user with this email
      prisma.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(fakeUser);
      mockBcrypt.compare.mockResolvedValue(false); // wrong password

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user has no password (OAuth only)', async () => {
      // Arrange — user registered via OAuth, no password set
      prisma.user.findUnique.mockResolvedValue({
        ...fakeUser,
        passwordHash: null,
      });

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is banned', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue({
        ...fakeUser,
        isBanned: true,
      });

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Account has been suspended',
      );
    });
  });

  // ================================================================
  // 🔴 RED: getProfile — describe expected behavior
  // ================================================================
  describe('getProfile', () => {
    it('should return user profile without passwordHash', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(fakeUser);

      // Act
      const result = await service.getProfile(fakeUser.id);

      // Assert
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe(fakeUser.email);
      expect(result.id).toBe(fakeUser.id);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getProfile('non-existent-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('socialLogin', () => {
    const socialDto = {
      email: 'google@stemverse.com',
      displayName: 'Google User',
      avatarUrl: 'https://avatar.url/1',
      role: 'remixer',
    };

    it('should auto-register a new social user and return JWT', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(null); // User not registered
      prisma.user.create = jest.fn().mockResolvedValue({
        ...fakeUser,
        email: socialDto.email,
        displayName: socialDto.displayName,
        avatarUrl: socialDto.avatarUrl,
        role: socialDto.role,
      });
      jwt.sign.mockReturnValue('social_jwt_token');

      // Act
      const result = await service.socialLogin(socialDto);

      // Assert
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: socialDto.email,
          displayName: socialDto.displayName,
          avatarUrl: socialDto.avatarUrl,
          role: socialDto.role,
        },
      });
      expect(result).toHaveProperty('access_token', 'social_jwt_token');
      expect(result.user.email).toBe(socialDto.email);
    });

    it('should return token and update info for existing social user', async () => {
      // Arrange
      const existingUser = {
        ...fakeUser,
        email: socialDto.email,
        displayName: socialDto.email.split('@')[0], // placeholder name
        avatarUrl: null, // missing avatar
      };
      prisma.user.findUnique.mockResolvedValue(existingUser);
      prisma.user.update = jest.fn().mockResolvedValue({
        ...existingUser,
        displayName: socialDto.displayName,
        avatarUrl: socialDto.avatarUrl,
      });
      jwt.sign.mockReturnValue('social_jwt_token_2');

      // Act
      const result = await service.socialLogin(socialDto);

      // Assert
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: existingUser.id },
        data: {
          avatarUrl: socialDto.avatarUrl,
          displayName: socialDto.displayName,
        },
      });
      expect(result).toHaveProperty('access_token', 'social_jwt_token_2');
    });
  });
});
