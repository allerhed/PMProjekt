import { useAuthStore } from '../../stores/authStore';
import { authApi } from '../../services/auth.api';

jest.mock('../../services/api');
jest.mock('../../services/auth.api');

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;

const mockUser = {
  userId: 'user-1',
  organizationId: 'org-1',
  role: 'org_admin',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
};

describe('authStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store between tests
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
    });
  });

  describe('login', () => {
    it('sets user and isAuthenticated on successful login', async () => {
      mockAuthApi.login.mockResolvedValue(mockUser);

      await useAuthStore.getState().login('test@example.com', 'password');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error on failed login', async () => {
      mockAuthApi.login.mockRejectedValue(new Error('Invalid credentials'));

      await expect(
        useAuthStore.getState().login('test@example.com', 'wrong'),
      ).rejects.toThrow('Invalid credentials');

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Invalid credentials');
    });
  });

  describe('register', () => {
    it('sets user and isAuthenticated on successful registration', async () => {
      mockAuthApi.register.mockResolvedValue(mockUser);

      await useAuthStore.getState().register({
        organizationName: 'Test Org',
        subdomain: 'test',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'Password1!',
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('sets error on failed registration', async () => {
      mockAuthApi.register.mockRejectedValue(new Error('Email already exists'));

      await expect(
        useAuthStore.getState().register({
          organizationName: 'Test Org',
          subdomain: 'test',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          password: 'Password1!',
        }),
      ).rejects.toThrow('Email already exists');

      const state = useAuthStore.getState();
      expect(state.error).toBe('Email already exists');
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('logout', () => {
    it('clears user and isAuthenticated', async () => {
      mockAuthApi.logout.mockResolvedValue(undefined);
      useAuthStore.setState({ user: mockUser, isAuthenticated: true });

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('clears state even if API call fails', async () => {
      mockAuthApi.logout.mockRejectedValue(new Error('Network error'));
      useAuthStore.setState({ user: mockUser, isAuthenticated: true });

      // logout() propagates the error via try/finally, but state is still cleared
      try {
        await useAuthStore.getState().logout();
      } catch {
        // expected
      }

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('checkAuth', () => {
    it('sets user when authenticated', async () => {
      mockAuthApi.getMe.mockResolvedValue(mockUser);

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('clears user when not authenticated', async () => {
      mockAuthApi.getMe.mockRejectedValue(new Error('Unauthorized'));

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('clearError', () => {
    it('clears the error state', () => {
      useAuthStore.setState({ error: 'some error' });

      useAuthStore.getState().clearError();

      expect(useAuthStore.getState().error).toBeNull();
    });
  });
});
