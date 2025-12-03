import { MongooseModuleOptions } from '@nestjs/mongoose';

export const getMongoConfig = (): MongooseModuleOptions => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/knowlens';

  return {
    uri,
    retryWrites: true,
    w: 'majority',
  };
};
