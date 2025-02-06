const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

let testUserAuthToken, adminUser;
const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };


if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimeout(60 * 1000 * 5); 
}

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
  const registerResponse = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerResponse.body.token;
  expectValidJwt(testUserAuthToken);

  adminUser = await createAdminUser();
  const adminResponse = await request(app).put('/api/auth').send(adminUser);
  adminToken = adminResponse.body.token;
  expectValidJwt(adminToken);
});


test('List all the franchises', async () => {
  const response = await request(app).get('/api/franchise');
  expect(response.status).toBe(200);
  expect(Array.isArray(response.body)).toBe(true);
});

test('List a user\'s franchises', async () => {
  const response = await request(app).get('/api/franchise/2').set('Authorization', `Bearer ${testUserAuthToken}`);
  expect(response.status).toBe(200);
  expect(Array.isArray(response.body)).toBe(true);
});

test('Create a new franchise', async () => {
  const newFranchise = { name: 'pizzaError', admins: [{ email: 'nonadmin@jwt.com' }] };
  const response = await request(app).post('/api/franchise').set('Authorization', `Bearer ${testUserAuthToken}`).send(newFranchise);
  expect(response.status).toBe(403);
});

test('Delete a franchise as admin', async () => {
  const response = await request(app).delete(`/api/franchise/1`).set('Authorization', `Bearer ${adminToken}`);
  expect(response.status).toBe(200);
  expect(response.body.message).toBe('franchise deleted');
});

test('Delete a franchise as not admin)', async () => {
  const franchiseId = 1;
  const response = await request(app).delete(`/api/franchise/${franchiseId}`).set('Authorization', `Bearer ${testUserAuthToken}`);
  expect(response.status).toBe(403);
});

test('Create a new store as admin', async () => {
    const newFranchise = { name: randomName(), admins: [{ email: adminUser.email }] };
    const franchiseResponse = await request(app).post('/api/franchise').set('Authorization', `Bearer ${adminToken}`).send(newFranchise);
    const newStore = { name: randomName() };
    const createResponse = await request(app).post(`/api/franchise/${franchiseResponse.body.id}/store`).set('Authorization', `Bearer ${adminToken}`).send(newStore);

    expect(createResponse.status).toBe(200);
    expect(createResponse.body).toHaveProperty('id');
    expect(createResponse.body.name).toBe(newStore.name);
});