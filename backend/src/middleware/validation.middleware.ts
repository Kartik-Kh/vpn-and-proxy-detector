import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        error: error.details[0].message
      });
    }
    
    next();
  };
};

export const schemas = {
  ipDetection: Joi.object({
    ip: Joi.alternatives().try(
      Joi.string().ip({ version: ['ipv4', 'ipv6'] }),
      Joi.string().domain()
    ).required().messages({
      'alternatives.match': 'Must be a valid IP address (IPv4/IPv6) or domain name',
      'any.required': 'IP address or domain is required'
    })
  }),

  bulkDetection: Joi.object({
    ips: Joi.array().items(
      Joi.alternatives().try(
        Joi.string().ip({ version: ['ipv4', 'ipv6'] }),
        Joi.string().domain()
      )
    ).min(1).max(100).required().messages({
      'array.min': 'At least one IP address or domain is required',
      'array.max': 'Maximum 100 addresses allowed'
    })
  }),

  login: Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required()
  }),

  register: Joi.object({
    username: Joi.string().min(3).max(30).required(),
    password: Joi.string().min(6).required(),
    email: Joi.string().email().required()
  })
};