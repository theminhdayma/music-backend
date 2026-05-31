import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  getProfile: jest.fn(),
  socialLogin: jest.fn(),
};

const fakeAuthResponse = {
  access_token: 'jwt_token_mock',
  user: {
    id: 'user-uuid',
    email: 'test@stemverse.com',
    role: 'consumer',
    displayName: 'Test User',
    avatarUrl: null,
    bio: null,
    isVerified: false,
    isBanned: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

describe('AuthController', () => {
  let controller: AuthController;
  let authService: typeof mockAuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /auth/register', () => {
    it('should call authService.register and return result', async () => {
      const dto = { email: 'new@test.com', password: 'Test1234!' };
      authService.register.mockResolvedValue(fakeAuthResponse);

      const result = await controller.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(fakeAuthResponse);
    });
  });

  describe('POST /auth/login', () => {
    it('should call authService.login and return result', async () => {
      const dto = { email: 'test@stemverse.com', password: 'Test1234!' };
      authService.login.mockResolvedValue(fakeAuthResponse);

      const result = await controller.login(dto);

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(result).toEqual(fakeAuthResponse);
    });
  });

  describe('GET /auth/me', () => {
    it('should call authService.getProfile with userId from JWT', async () => {
      const fakeUser = fakeAuthResponse.user;
      authService.getProfile.mockResolvedValue(fakeUser);

      const req = {
        user: {
          userId: 'user-uuid',
          email: 'test@stemverse.com',
          role: 'consumer',
        },
      };
      const result = await controller.getProfile(req);

      expect(authService.getProfile).toHaveBeenCalledWith('user-uuid');
      expect(result).toEqual(fakeUser);
    });
  });

  describe('POST /auth/social-login', () => {
    it('should call authService.socialLogin and return result', async () => {
      const dto = {
        email: 'google@test.com',
        displayName: 'G User',
        role: 'remixer',
      };
      authService.socialLogin.mockResolvedValue(fakeAuthResponse);

      const result = await controller.socialLogin(dto);

      expect(authService.socialLogin).toHaveBeenCalledWith(dto);
      expect(result).toEqual(fakeAuthResponse);
    });
  });
});
