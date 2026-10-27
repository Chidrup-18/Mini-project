declare global {
  namespace Express {
    interface Request {
      authUser?: { id: string; email: string; displayName: string; role: string };
    }
  }
}

export {};
