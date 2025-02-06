const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

let testUserAuthToken, adminUser, adminToken;
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

test("Add Item", async () => {
  const newItem = {title: randomName(), description: randomName(), image:randomName() + ".png", price: 9.99 };
  const AddMenuRes = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${adminToken}`).send(newItem);
  expect(AddMenuRes.status).toBe(200);
});

test("Get Menu", async () => {
    const menuResponse = await request(app).get('/api/order/menu');
    menuResponse.body.forEach(item => {
      expect(item).toHaveProperty('price');
    })
    expect(menuResponse.status).toBe(200);
});

test("Create Order", async () => {
    const createOrderResponse = await request(app).post('/api/order').set('Authorization', `Bearer ${testUserAuthToken}`).send({franchiseId: 1, storeId: 1, items:[{menuId: 1, description: randomName(), price: 9.99}]});
    expect(createOrderResponse.status).toBe(200);
    expect(createOrderResponse.body).toHaveProperty('order');
});

test("Get Order", async () => {
    const getOrderResponse = await request(app).get('/api/order').set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(getOrderResponse.status).toBe(200);
    expect(getOrderResponse.body).toHaveProperty("dinerId");
  });