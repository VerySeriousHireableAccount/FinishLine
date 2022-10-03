import prisma from '../prisma/prisma';
import { Request, Response } from 'express';
import {
  changeRequestRelationArgs,
  changeRequestTransformer,
  sendSlackChangeRequestNotification
} from '../utils/change-requests.utils';
import { validationResult } from 'express-validator';
import { CR_Type, Role, WBS_Element_Status } from '@prisma/client';
import { getUserFullName } from '../utils/users.utils';

export const getAllChangeRequests = async (req: Request, res: Response) => {
  const changeRequests = await prisma.change_Request.findMany(changeRequestRelationArgs);
  return res.status(200).json(changeRequests.map(changeRequestTransformer));
};

// Fetch the specific change request by its integer ID
export const getChangeRequestByID = async (req: Request, res: Response) => {
  const crId: number = parseInt(req.params.crId);
  const requestedCR = await prisma.change_Request.findUnique({
    where: { crId },
    ...changeRequestRelationArgs
  });
  if (requestedCR === null) {
    return res.status(404).json({ message: `change request with id ${crId} not found!` });
  }
  return res.status(200).json(changeRequestTransformer(requestedCR));
};

// handle reviewing of change requests
export const reviewChangeRequest = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { body } = req;
  const { reviewerId, crId, reviewNotes, accepted, psId } = body;

  // verify that the user is allowed review change requests
  const reviewer = await prisma.user.findUnique({ where: { userId: reviewerId } });
  if (!reviewer) return res.status(404).json({ message: `User with id #${reviewerId} not found` });
  if (reviewer.role === Role.GUEST || reviewer.role === Role.MEMBER)
    return res.status(401).json({ message: 'Access Denied' });

  // ensure existence of change request
  const foundCR = await prisma.change_Request.findUnique({ where: { crId } });
  if (!foundCR)
    return res.status(404).json({ message: `change request with id #${crId} not found` });

  if (foundCR.accepted)
    return res.status(400).json({ message: `This change request is already approved!` });

  // verify that the user is not reviewing their own change request
  if (reviewerId === foundCR.submitterId) return res.status(401).json({ message: 'Access Denied' });

  // if Scope CR, make sure that a proposed solution is selected before approving
  const foundScopeCR = await prisma.scope_CR.findUnique({ where: { changeRequestId: crId } });
  if (foundScopeCR && accepted === true) {
    if (!psId)
      return res
        .status(400)
        .json({ message: 'No proposed solution selected for scope change request' });
    const foundPs = await prisma.proposed_Solution.findUnique({
      where: { proposedSolutionId: psId }
    });
    if (!foundPs || foundPs.changeRequestId !== foundScopeCR.scopeCrId)
      return res.status(400).json({
        message: `Proposed solution with id #${psId} not found for change request #${crId}`
      });
    // update proposed solution
    await prisma.proposed_Solution.update({
      where: { proposedSolutionId: psId },
      data: {
        approved: true
      }
    });
  }

  // update change request
  const updated = await prisma.change_Request.update({
    where: { crId },
    data: {
      reviewer: { connect: { userId: reviewerId } },
      reviewNotes,
      accepted,
      dateReviewed: new Date()
    },
    include: { activationChangeRequest: true, wbsElement: { include: { workPackage: true } } }
  });

  // verify wbs element exists
  const wbsElement = await prisma.wBS_Element.findUnique({
    where: {
      wbsElementId: updated.wbsElementId
    },
    include: {
      workPackage: true
    }
  });

  if (!wbsElement) {
    return res
      .status(404)
      .json({ message: `wbs element with id #${updated.wbsElementId} not found` });
  }

  const progress: number | undefined = wbsElement.workPackage?.progress;

  if (updated.accepted && foundCR.type === CR_Type.STAGE_GATE) {
    const shouldChangeStatus = wbsElement.status !== WBS_Element_Status.COMPLETE;
    const shouldChangeProgress = progress !== 100;

    const changesList = [];
    if (shouldChangeStatus) {
      changesList.push({
        changeRequestId: crId,
        implementerId: reviewerId,
        detail: `Changed status from ${wbsElement.status} to ${WBS_Element_Status.COMPLETE}`
      });
    }

    if (shouldChangeProgress) {
      changesList.push({
        changeRequestId: crId,
        implementerId: reviewerId,
        detail: `Changed progress from ${progress} to 100`
      });
    }

    await prisma.work_Package.update({
      where: { wbsElementId: wbsElement.wbsElementId },
      data: {
        wbsElement: {
          update: {
            status: WBS_Element_Status.COMPLETE,
            changes: {
              createMany: {
                data: changesList
              }
            }
          }
        },
        progress: 100
      }
    });
  }

  // if it's an activation cr and being accepted, we can do some stuff to the associated work package
  if (updated.type === CR_Type.ACTIVATION && updated.activationChangeRequest && accepted) {
    const { activationChangeRequest: actCr, wbsElement } = updated;
    const shouldUpdateProjLead = actCr.projectLeadId !== wbsElement.projectLeadId;
    const shouldUpdateProjManager = actCr.projectManagerId !== wbsElement.projectManagerId;
    const shouldChangeStartDate =
      actCr.startDate.setHours(0, 0, 0, 0) !==
      wbsElement.workPackage?.startDate.setHours(0, 0, 0, 0);

    const changes = [];
    if (shouldUpdateProjLead) {
      const oldPL = await getUserFullName(wbsElement.projectLeadId);
      const newPL = await getUserFullName(actCr.projectLeadId);
      changes.push({
        changeRequestId: updated.crId,
        implementerId: reviewerId,
        wbsElementId: updated.wbsElementId,
        detail: `Project Lead changed from "${oldPL}" to "${newPL}"`
      });
    }

    if (shouldUpdateProjManager) {
      const oldPM = await getUserFullName(wbsElement.projectManagerId);
      const newPM = await getUserFullName(actCr.projectManagerId);
      changes.push({
        changeRequestId: updated.crId,
        implementerId: reviewerId,
        wbsElementId: updated.wbsElementId,
        detail: `Project Lead changed from "${oldPM}" to "${newPM}"`
      });
    }

    if (shouldChangeStartDate) {
      changes.push({
        changeRequestId: updated.crId,
        implementerId: reviewerId,
        wbsElementId: updated.wbsElementId,
        detail: `Start Date changed from "${wbsElement.workPackage?.startDate.toLocaleDateString()}"\
                 to "${actCr.startDate.toLocaleDateString()}"`
      });
    }

    changes.push({
      changeRequestId: updated.crId,
      implementerId: reviewerId,
      wbsElementId: updated.wbsElementId,
      detail: `Changed status from ${wbsElement.status} to ${WBS_Element_Status.ACTIVE}`
    });

    await prisma.change.createMany({ data: changes });
    await prisma.wBS_Element.update({
      where: { wbsElementId: updated.wbsElementId },
      data: {
        projectLeadId: actCr.projectLeadId,
        projectManagerId: actCr.projectManagerId,
        workPackage: { update: { startDate: actCr.startDate } },
        status: WBS_Element_Status.ACTIVE
      }
    });
  }

  // TODO: handle errors
  return res
    .status(200)
    .json({ message: `Change request #${updated.crId} successfully reviewed.` });
};

export const createActivationChangeRequest = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { body } = req;

  // verify user is allowed to create activation change requests
  const user = await prisma.user.findUnique({ where: { userId: body.submitterId } });
  if (!user) {
    return res.status(404).json({ message: `user with id #${body.submitterId} not found` });
  }
  if (user.role === Role.GUEST) return res.status(401).json({ message: 'Access Denied' });

  // verify wbs element exists
  const wbsElement = await prisma.wBS_Element.findUnique({
    where: {
      wbsNumber: {
        carNumber: body.wbsNum.carNumber,
        projectNumber: body.wbsNum.projectNumber,
        workPackageNumber: body.wbsNum.workPackageNumber
      }
    }
  });

  if (wbsElement === null) {
    return res.status(404).json({ message: `wbs number ${body.wbsNum} not found` });
  }

  const createdCR = await prisma.change_Request.create({
    data: {
      submitter: { connect: { userId: body.submitterId } },
      wbsElement: { connect: { wbsElementId: wbsElement.wbsElementId } },
      type: body.type,
      activationChangeRequest: {
        create: {
          projectLead: { connect: { userId: body.projectLeadId } },
          projectManager: { connect: { userId: body.projectManagerId } },
          startDate: new Date(body.startDate),
          confirmDetails: body.confirmDetails
        }
      }
    },
    include: {
      wbsElement: {
        include: {
          workPackage: {
            include: {
              project: { include: { team: { include: { leader: true } }, wbsElement: true } }
            }
          }
        }
      }
    }
  });

  const team = createdCR.wbsElement.workPackage?.project.team;
  if (team) {
    const slackMsg =
      `${user.firstName} ${user.lastName} wants to activate ${createdCR.wbsElement.name}` +
      ` in ${createdCR.wbsElement.workPackage?.project.wbsElement.name}`;
    await sendSlackChangeRequestNotification(team, slackMsg, createdCR.crId);
  }

  return res.status(200).json({
    message: `Successfully created activation change request #${createdCR.crId}.`
  });
};

export const createStageGateChangeRequest = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { body } = req;

  // verify user is allowed to create stage gate change requests
  const user = await prisma.user.findUnique({ where: { userId: body.submitterId } });
  if (!user)
    return res.status(404).json({ message: `user with id #${body.submitterId} not found` });
  if (user.role === Role.GUEST) return res.status(401).json({ message: 'Access Denied' });

  // verify wbs element exists
  const wbsElement = await prisma.wBS_Element.findUnique({
    where: {
      wbsNumber: {
        carNumber: body.wbsNum.carNumber,
        projectNumber: body.wbsNum.projectNumber,
        workPackageNumber: body.wbsNum.workPackageNumber
      }
    }
  });
  if (wbsElement === null) {
    return res.status(404).json({ message: `wbs number ${body.wbsNum} not found` });
  }

  const createdChangeRequest = await prisma.change_Request.create({
    data: {
      submitter: { connect: { userId: body.submitterId } },
      wbsElement: { connect: { wbsElementId: wbsElement.wbsElementId } },
      type: body.type,
      stageGateChangeRequest: {
        create: {
          leftoverBudget: body.leftoverBudget,
          confirmDone: body.confirmDone
        }
      }
    },
    include: {
      wbsElement: {
        include: {
          workPackage: {
            include: {
              project: { include: { team: { include: { leader: true } }, wbsElement: true } }
            }
          }
        }
      }
    }
  });

  const team = createdChangeRequest.wbsElement.workPackage?.project.team;
  if (team) {
    const slackMsg =
      `${user.firstName} ${user.lastName} wants to stage gate ${createdChangeRequest.wbsElement.name}` +
      ` in ${createdChangeRequest.wbsElement.workPackage?.project.wbsElement.name}`;
    await sendSlackChangeRequestNotification(team, slackMsg, createdChangeRequest.crId);
  }

  return res.status(200).json({
    message: `Successfully created stage gate change request #${createdChangeRequest.crId}.`
  });
};

export const createStandardChangeRequest = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { body } = req;

  // verify user is allowed to create stage gate change requests
  const user = await prisma.user.findUnique({ where: { userId: body.submitterId } });
  if (!user) {
    return res.status(404).json({ message: `user with id #${body.submitterId} not found` });
  }
  if (user.role === Role.GUEST) return res.status(401).json({ message: 'Access Denied' });

  // verify wbs element exists
  const wbsElement = await prisma.wBS_Element.findUnique({
    where: {
      wbsNumber: {
        carNumber: body.wbsNum.carNumber,
        projectNumber: body.wbsNum.projectNumber,
        workPackageNumber: body.wbsNum.workPackageNumber
      }
    }
  });

  if (!wbsElement) {
    return res.status(404).json({ message: `wbs number ${body.wbsNum} not found` });
  }

  const createdCR = await prisma.change_Request.create({
    data: {
      submitter: { connect: { userId: body.submitterId } },
      wbsElement: { connect: { wbsElementId: wbsElement.wbsElementId } },
      type: body.type,
      scopeChangeRequest: {
        create: {
          what: body.what,
          scopeImpact: '',
          timelineImpact: 0,
          budgetImpact: 0,
          why: { createMany: { data: body.why } }
        }
      }
    },
    include: {
      wbsElement: {
        include: {
          project: { include: { team: { include: { leader: true } }, wbsElement: true } },
          workPackage: {
            include: {
              project: { include: { team: { include: { leader: true } }, wbsElement: true } }
            }
          }
        }
      }
    }
  });

  const project = createdCR.wbsElement.workPackage?.project || createdCR.wbsElement.project;
  if (project?.team) {
    const slackMsg = `${body.type} CR submitted by ${user.firstName} ${user.lastName} for the ${project.wbsElement.name} project`;
    await sendSlackChangeRequestNotification(
      project.team,
      slackMsg,
      createdCR.crId,
      body.budgetImpact
    );
  }
  return res.status(200).json({
    message: `Successfully created standard change request #${createdCR.crId}.`
  });
};

export const addProposedSolution = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { body } = req;

  // verify user is allowed to create stage gate change requests
  const user = await prisma.user.findUnique({ where: { userId: body.submitterId } });
  if (!user) {
    return res.status(404).json({ message: `user with id #${body.submitterId} not found` });
  }
  if (user.role === Role.GUEST) return res.status(401).json({ message: 'Access Denied' });

  // ensure existence of change request
  const foundCR = await prisma.change_Request.findUnique({
    where: { crId: body.crId }
  });
  if (!foundCR)
    return res.status(404).json({ message: `change request with id #${body.crId} not found` });

  if (foundCR.accepted !== null) {
    return res
      .status(400)
      .json({ message: `cannot create proposed solutions on a reviewed change request!` });
  }

  // ensure existence of scope change request
  const foundScopeCR = await prisma.scope_CR.findUnique({ where: { changeRequestId: body.crId } });
  if (!foundScopeCR)
    return res
      .status(404)
      .json({ message: `scope change request with change request id #${body.crId} not found` });

  const createProposedSolution = await prisma.proposed_Solution.create({
    data: {
      description: body.description,
      scopeImpact: body.scopeImpact,
      timelineImpact: body.timelineImpact,
      budgetImpact: body.budgetImpact,
      changeRequest: { connect: { scopeCrId: foundScopeCR.scopeCrId } },
      createdBy: { connect: { userId: body.submitterId } }
    }
  });

  return res.status(200).json({
    message: `Successfully created the proposed solution #${createProposedSolution.proposedSolutionId}`
  });
};
