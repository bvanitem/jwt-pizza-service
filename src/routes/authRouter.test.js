const request = require('supertest');
const app = require('../service');

let testUserAuthToken, adminUser, adminToken;
const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };

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

function expectValidJwt(potentialJwt) {
    expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}

beforeAll(async () => {
  testUser.email = randomName() + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);

  adminUser = await createAdminUser();
  const adminLoginResponse = await request(app).put('/api/auth').send(adminUser);
  adminToken = adminLoginResponse.body.token;
  expectValidJwt(adminToken);
});

test('login', async () => {
  const loginResponse = await request(app).put('/api/auth').send(testUser);
  expect(loginResponse.status).toBe(200);
  expectValidJwt(loginResponse.body.token);

  const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
  delete expectedUser.password;
  expect(loginResponse.body.user).toMatchObject(expectedUser);
});

test('login unknown', async () =>{
  const unknownUser = {name: 'unknown', email: 'unknown@unknown.unknown', password: 'unknownunknown'};
  const loginResponse = await request(app).put('/api/auth').send(unknownUser);
  expect(loginResponse.status).toBe(404);
  expect(loginResponse.body.message).toMatch('unknown user');
});

test('register', async () => {
  const loginResponse = await request(app).post('/api/auth').send(testUser);
  expect(loginResponse.status).toBe(200);
  expect(loginResponse.body.user).toHaveProperty('id');
  expect(loginResponse.body.user.email).toBe(testUser.email);
  expect(loginResponse.body.user.roles).toEqual([{ role: 'diner' }]);
  expect(loginResponse.body).toHaveProperty('token');
});


test('register with missing fields', async () => {
  const response = await request(app).post('/api/auth').send({ email: 'test@test.com' });
  expect(response.status).toBe(400);
  expect(response.body.message).toBe('name, email, and password are required');
});

test('logout', async () => {
  const logoutResponse = (await request(app).delete('/api/auth').set('Authorization', `Bearer ${testUserAuthToken}`));
  expect(logoutResponse.status).toBe(200);
  expect(logoutResponse.body.message).toMatch('logout successful');
});

test('admin login', async () => {
  const adminUser = await createAdminUser();
  const loginResponse = (await request(app).put('/api/auth').send(adminUser));
  expect(loginResponse.status).toBe(200);

  const expectedUser = { ...adminUser, roles: [{ role: 'admin' }] };
  delete expectedUser.password;
  expect(loginResponse.body.user).toMatchObject(expectedUser);  
});
