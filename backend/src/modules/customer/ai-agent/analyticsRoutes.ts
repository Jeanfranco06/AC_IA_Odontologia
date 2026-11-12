import {Router} from 'express';
import {principalOf} from './authContext';
import {CustomerAnalyticsService as A,AnalyticsKind} from './services/customerAnalyticsService';
const router=Router();
router.get('/catalog',(req,res,next)=>A.catalog(principalOf(req)).then(data=>res.json({success:true,data})).catch(next));
router.post('/:kind',(req,res,next)=>A.query(principalOf(req),String(req.params.kind) as AnalyticsKind,req.body).then(data=>res.json({success:true,data})).catch(next));
export default router;
