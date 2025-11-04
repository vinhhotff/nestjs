import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import mongoose, { HydratedDocument, Types } from 'mongoose';
import { softDeletePlugin } from 'soft-delete-plugin-mongoose';
import { Role } from 'src/role/schemas/role.schema';
export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User extends mongoose.Document {
  @Prop()
  name?: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Role',
    default: '6891b5da7f6c9b1ab0424aa0',
  })
  role: Role | Types.ObjectId;

  @Prop({ default: true })
  isMember: boolean;

  @Prop()
  phone?: string;

  @Prop()
  address?: string;
  @ApiProperty()
  avatar?: string;

  @Prop({
    type: [{ type: mongoose.Types.ObjectId, ref: 'Payment' }],
    default: [],
  })
  transactions: mongoose.Types.ObjectId[];

  @Prop({ type: Object })
  createdBy?: {
    _id: mongoose.Schema.Types.ObjectId;
    email: string;
  };

  @Prop({ type: Object })
  updatedBy?: {
    _id: mongoose.Schema.Types.ObjectId;
    email: string;
  };

  @Prop({ type: Object })
  deletedBy?: {
    _id: mongoose.Schema.Types.ObjectId;
    email: string;
  };

  @Prop()
  refreshToken?: string;

  // Timestamps are automatically handled by Mongoose when timestamps: true
  createdAt: Date;
  updatedAt: Date;

  // Soft delete fields are handled by the plugin
  isDeleted?: boolean;
  deletedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.plugin(softDeletePlugin);

// Add index for analytics performance
UserSchema.index({ createdAt: 1 });
