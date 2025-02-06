const request = require('supertest');
const app = require('../service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

const { Role, DB } = require('../database/database.js');

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  user = await DB.addUser(user);
  return { ...user, password: 'toomanysecrets' };
}

function randomName() {
    return Math.random().toString(36).substring(2, 12);
  }

beforeAll(async () => {
  testUser.email = randomName() + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
});

test('register', async () => {
  const loginRes = await request(app).post('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.user).toHaveProperty('id');
  expect(loginRes.body.user.email).toBe(testUser.email);
  expect(loginRes.body.user.roles).toEqual([{ role: 'diner' }]);
  expect(loginRes.body).toHaveProperty('token');
});

test('logout', async () => {
  const logoutRes = (await request(app).delete('/api/auth').set('Authorization', `Bearer ${testUserAuthToken}`));
  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body.message).toMatch('logout successful');
});

test('admin login', async () => {
  const adminUser = await createAdminUser();
  const loginRes = (await request(app).put('/api/auth').send(adminUser));
  expect(loginRes.status).toBe(200);

  const expectedUser = { ...adminUser, roles: [{ role: 'admin' }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);  
});


function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}