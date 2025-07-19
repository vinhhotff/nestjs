import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class Resume {
  @Prop({ required: true })
  email: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  url: string;

  @Prop({
    type: String,
    enum: ['PENDING', 'REVIEWING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
  })
  status: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Company', required: true })
  companyId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Job', required: true })
  jobId: Types.ObjectId;

  @Prop([
    {
      status: { type: String, required: true },
      updatedAt: { type: Date, required: true },
      updatedBy: {
        _id: { type: MongooseSchema.Types.ObjectId, ref: 'User' },
        email: { type: String },
      },
    },
  ])
  history: {
    status: string;
    updatedAt: Date;
    updatedBy: {
      _id: Types.ObjectId;
      email: string;
    };
  }[];

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({
    _id: { type: MongooseSchema.Types.ObjectId, ref: 'User' },
    email: String,
  })
  createdBy: {
    _id: Types.ObjectId;
    email: string;
  };

  @Prop({
    _id: { type: MongooseSchema.Types.ObjectId, ref: 'User' },
    email: String,
  })
  updatedBy: {
    _id: Types.ObjectId;
    email: string;
  };

  @Prop({
    _id: { type: MongooseSchema.Types.ObjectId, ref: 'User' },
    email: String,
  })
  deleteBy: {
    _id: Types.ObjectId;
    email: string;
  };
}

export const ResumeSchema = SchemaFactory.createForClass(Resume);
