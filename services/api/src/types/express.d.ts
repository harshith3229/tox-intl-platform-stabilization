declare global {
  namespace Express {
    interface Request {
      demoUser: {
        id: string;
        name: string;
        organisationId: string;
        organisationName: string;
      };
    }
  }
}

export {};
