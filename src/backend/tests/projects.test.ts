import request from 'supertest';
import express from 'express';
import projectRouter from '../src/routes/projects.routes';
import prisma from '../src/prisma/prisma';
import { getChangeRequestReviewState, getHighestProjectNumber, projectTransformer } from '../src/utils/projects.utils';
import { batman } from './test-data/users.test-data';
import { wbsElement1 } from './test-data/projects.test-data';

const app = express();
app.use(express.json());
app.use('/', projectRouter);

jest.mock('../src/utils/projects.utils');
const mockGetChangeRequestReviewState = getChangeRequestReviewState as jest.Mock<Promise<boolean | null>>;
const mockGetHighestProjectNumber = getHighestProjectNumber as jest.Mock<Promise<number>>;

const mockProjectTransformer = projectTransformer as jest.Mock;

const newProjectPayload = {
  userId: 1,
  crId: 2,
  name: 'build a car',
  carNumber: 3,
  summary: 'we are building a car'
};

const editProjectPayload = {
  ...newProjectPayload,
  budget: 100,
  projectId: 4,
  rules: ['a', 'b', 'c'],
  goals: [{ id: 1, detail: 'd' }],
  features: [{ id: 1, detail: 'e' }],
  otherConstraints: [{ id: 1, detail: 'f' }],
  wbsElementStatus: 'ACTIVE',
  googleDriveFolderLink: 'a',
  slideDeckLink: 'g',
  bomLink: 'h',
  taskListLink: 'i',
  projectLead: 5,
  projectManager: 6
};

describe('Projects', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('newProject fails with invalid userId', async () => {
    const proj = { ...newProjectPayload, userId: -1 };
    const res = await request(app).post('/new').send(proj);

    expect(res.statusCode).toBe(400);
  });

  test('newProject fails with invalid crId', async () => {
    const proj = { ...newProjectPayload, crId: 'asdf' };
    const res = await request(app).post('/new').send(proj);

    expect(res.statusCode).toBe(400);
  });

  test('newProject fails with invalid name', async () => {
    const proj = { ...newProjectPayload, name: '' };
    const res = await request(app).post('/new').send(proj);

    expect(res.statusCode).toBe(400);
  });

  test('newProject works', async () => {
    mockGetChangeRequestReviewState.mockResolvedValue(true);
    mockGetHighestProjectNumber.mockResolvedValue(0);
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({ ...batman, googleAuthId: 'b' });
    jest.spyOn(prisma.wBS_Element, 'create').mockResolvedValue({
      wbsElementId: 1,
      status: 'ACTIVE',
      carNumber: 1,
      projectNumber: 2,
      workPackageNumber: 3,
      dateCreated: new Date(),
      name: 'car',
      projectLeadId: 4,
      projectManagerId: 5
    });

    const res = await request(app).post('/new').send(newProjectPayload);

    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      wbsNumber: { carNumber: 1, projectNumber: 2, workPackageNumber: 3 }
    });
  });

  test('editProject fails with feature with no detail', async () => {
    const proj = { ...editProjectPayload, features: [{ id: 4 }] };
    const res = await request(app).post('/edit').send(proj);

    expect(res.statusCode).toBe(400);
  });

  test('editProject fails with feature with invalid id', async () => {
    const proj = { ...editProjectPayload, features: [{ id: -1, detail: 'alsdjf' }] };
    const res = await request(app).post('/edit').send(proj);

    expect(res.statusCode).toBe(400);
  });

  test('editProject fails with feature with invalid detail', async () => {
    const proj = { ...editProjectPayload, features: [{ id: 4, detail: '' }] };
    const res = await request(app).post('/edit').send(proj);

    expect(res.statusCode).toBe(400);
  });

  test('getSingleProject fails given invalid project wbs number', async () => {
    let res = await request(app).get('/1.0.1');
    expect(res.statusCode).toBe(404);
    expect(res.body).toStrictEqual({ message: `1.0.1 is not a valid project WBS #!` });

    res = await request(app).get('/2.0.2');
    expect(res.statusCode).toBe(404);
    expect(res.body).toStrictEqual({ message: `2.0.2 is not a valid project WBS #!` });
  });

  test('getSingleProject fails when associated wbsElement doesnt exist', async () => {
    jest.spyOn(prisma.wBS_Element, 'findUnique').mockResolvedValue(null);
    let res = await request(app).get('/1.3.0');
    expect(res.statusCode).toBe(404);
    expect(res.body).toStrictEqual({ message: 'project 1.3.0 not found!' });

    res = await request(app).get('/2.4.0');
    expect(res.statusCode).toBe(404);
    expect(res.body).toStrictEqual({ message: 'project 2.4.0 not found!' });
  });

  test('getSingleProject works', async () => {
    jest.spyOn(prisma.wBS_Element, 'findUnique').mockResolvedValue(wbsElement1);
    mockProjectTransformer.mockReturnValue({ message: 'projectTransformer called' });
    const res = await request(app).get('/1.2.0');

    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({ message: 'projectTransformer called' });
  });

  test('getAllProjects works', async () => {
    jest.spyOn(prisma.project, 'findMany').mockResolvedValue([]);
    const res = await request(app).get('');

    expect(res.statusCode).toBe(200);
    expect(prisma.project.findMany).toHaveBeenCalledTimes(1);
    expect(res.body).toStrictEqual([]);
  });
});
