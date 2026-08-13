import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Department, DepartmentDocument } from './schemas/department.schema';
import { Team, TeamDocument } from './schemas/team.schema';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectModel(Department.name)
    private readonly deptModel: Model<DepartmentDocument>,
    @InjectModel(Team.name)
    private readonly teamModel: Model<TeamDocument>,
  ) {}

  listDepartments(organizationId: string) {
    return this.deptModel
      .find({ organizationId: new Types.ObjectId(organizationId) })
      .sort({ name: 1 })
      .exec();
  }

  createDepartment(organizationId: string, name: string, description?: string) {
    return this.deptModel.create({
      organizationId: new Types.ObjectId(organizationId),
      name,
      description,
    });
  }

  listTeams(organizationId: string, departmentId?: string) {
    const filter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
    };
    if (departmentId) {
      filter.departmentId = new Types.ObjectId(departmentId);
    }
    return this.teamModel.find(filter).sort({ name: 1 }).exec();
  }

  async createTeam(
    organizationId: string,
    departmentId: string,
    name: string,
  ) {
    const dept = await this.deptModel.findById(departmentId).exec();
    if (!dept || dept.organizationId.toString() !== organizationId) {
      throw new NotFoundException('Không tìm thấy phòng ban');
    }
    return this.teamModel.create({
      organizationId: new Types.ObjectId(organizationId),
      departmentId: new Types.ObjectId(departmentId),
      name,
    });
  }

  async updateDepartment(
    organizationId: string,
    departmentId: string,
    data: { name?: string; description?: string },
  ) {
    const dept = await this.deptModel
      .findOneAndUpdate(
        {
          _id: departmentId,
          organizationId: new Types.ObjectId(organizationId),
        },
        data,
        { new: true },
      )
      .exec();
    if (!dept) throw new NotFoundException('Không tìm thấy phòng ban');
    return dept;
  }

  async deleteDepartment(organizationId: string, departmentId: string) {
    const teams = await this.teamModel.countDocuments({
      departmentId: new Types.ObjectId(departmentId),
    });
    if (teams > 0) {
      throw new BadRequestException('Phòng ban còn nhóm, không thể xóa');
    }
    await this.deptModel.deleteOne({
      _id: departmentId,
      organizationId: new Types.ObjectId(organizationId),
    });
    return { deleted: true };
  }
}
