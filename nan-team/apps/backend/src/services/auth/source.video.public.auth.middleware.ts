import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { OAuthService } from '@gitroom/nestjs-libraries/database/prisma/oauth/oauth.service';
import { extractBearerToken } from '@gitroom/nestjs-libraries/chat/oauth-types';

@Injectable()
export class SourceVideoPublicAuthMiddleware implements NestMiddleware {
  constructor(private readonly organizations:OrganizationService,private readonly oauth:OAuthService){}
  async use(req:Request,res:Response,next:NextFunction){
    const header=req.headers.authorization;
    const token=extractBearerToken(header)||(typeof header==='string'&&!/^bearer\b/i.test(header)?header.trim():undefined);
    if(!token){res.status(401).json({error:'Source video operation requires authentication'});return;}
    try{
      const org=token.startsWith('pos_')?(await this.oauth.getOrgByOAuthToken(token))?.organization:await this.organizations.getOrgByApiKey(token);
      if(!org||org.deletedAt){res.status(401).json({error:'Invalid source video credential'});return;}
      // Match MCP tenant scope; never honor caller-provided organization overrides.
      (req as Request&{org:unknown}).org=org;
      next();
    }catch{res.status(401).json({error:'Invalid source video credential'});}
  }
}
