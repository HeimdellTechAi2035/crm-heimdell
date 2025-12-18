import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Auth Routes', () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  it('should register a new user', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        organizationName: 'Test Org',
      },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.user).toBeDefined();
    expect(data.token).toBeDefined();
    token = data.token;
  });

  it('should not allow duplicate email', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        organizationName: 'Test Org',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should login with valid credentials', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'password123',
      },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.user).toBeDefined();
    expect(data.token).toBeDefined();
  });

  it('should not login with invalid credentials', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'wrongpassword',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should get current user with valid token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.user.email).toBe('test@example.com');
  });

  it('should fail without token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('Leads Routes', () => {
  let app: FastifyInstance;
  let token: string;
  let leadId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Login to get token
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'password123',
      },
    });
    const loginData = JSON.parse(loginResponse.body);
    token = loginData.token;
  });

  it('should create a lead', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/leads',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        email: 'lead@example.com',
        firstName: 'John',
        lastName: 'Doe',
        status: 'new',
      },
    });

    expect(response.statusCode).toBe(201);
    const data = JSON.parse(response.body);
    expect(data.lead).toBeDefined();
    expect(data.lead.email).toBe('lead@example.com');
    leadId = data.lead.id;
  });

  it('should get leads list', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/leads',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.leads).toBeDefined();
    expect(Array.isArray(data.leads)).toBe(true);
  });

  it('should get a single lead', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/leads/${leadId}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.lead.id).toBe(leadId);
  });

  it('should update a lead', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/leads/${leadId}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        status: 'qualified',
      },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.lead.status).toBe('qualified');
  });

  it('should fail to access leads without auth', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/leads',
    });

    expect(response.statusCode).toBe(401);
  });
});

