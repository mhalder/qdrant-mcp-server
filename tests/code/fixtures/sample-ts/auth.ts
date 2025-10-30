export interface User {
  id: string;
  email: string;
  name: string;
}

export class AuthService {
  private users: Map<string, User> = new Map();

  async authenticate(email: string, _password: string): Promise<User | null> {
    const user = Array.from(this.users.values()).find((u) => u.email === email);
    if (!user) {
      return null;
    }
    return user;
  }

  async register(email: string, name: string, _password: string): Promise<User> {
    const user: User = {
      id: Math.random().toString(36),
      email,
      name,
    };
    this.users.set(user.id, user);
    return user;
  }

  async getUser(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }
}
