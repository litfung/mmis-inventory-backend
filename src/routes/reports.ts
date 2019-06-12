import { MainReportModel } from "../models/reports/mainReport";
import * as express from 'express';
import * as wrap from 'co-express';
import * as moment from 'moment';
import * as _ from 'lodash';
import { InventoryReportModel } from "../models/inventoryReport";
import { start } from "repl";
const router = express.Router();
const mainReportModel = new MainReportModel();
const inventoryReportModel = new InventoryReportModel();

function printDate(SYS_PRINT_DATE) {
  moment.locale('th');
  let printDate
  if (SYS_PRINT_DATE === 'Y') {
    printDate = 'วันที่พิมพ์ ' + moment().format('D MMMM ') + (moment().get('year') + 543) + moment().format(', HH:mm:ss น.');
  } else {
    printDate = '';
  }
  return printDate;
}

router.get('/account/payable', wrap(async (req, res, next) => {
  try {
    const db = req.db;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const genericTypeId = req.query.genericTypeId;
    const sys_hospital = req.decoded.SYS_HOSPITAL;
    const warehouseId = req.decoded.warehouseId;
    const hospcode = JSON.parse(sys_hospital).hospcode
    const hospname = JSON.parse(sys_hospital).hospname
    const gt: any = await inventoryReportModel.getGenericType(db, genericTypeId);
    const rs: any = await mainReportModel.accountPayable(db, startDate, endDate, genericTypeId);
    if (rs.length > 0) {
      let sum: any = 0;
      for (const i of rs) {
        i.delivery_date = moment(i.delivery_date).locale('th').format('DD MMM') + (moment(i.delivery_date).get('year') + 543);
        sum += i.cost;
        i.cost = inventoryReportModel.comma(i.cost);
      }
      sum = inventoryReportModel.comma(sum);
      res.render('account_payable', {
        hospname: hospname,
        details: rs,
        sumCost: sum,
        genericTypeName: gt[0].generic_type_name,
        printDate: 'วันที่พิมพ์ ' + moment().format('D MMMM ') + (moment().get('year') + 543) + moment().format(', HH:mm:ss น.')

      });
    } else {
      res.render('error404')
    }

  } catch (error) {
    res.render('error404', {
      title: error
    })
  }
}));

router.get('/account/payable/select', wrap(async (req, res, next) => {
  try {
    const db = req.db;
    const sys_hospital = req.decoded.SYS_HOSPITAL;
    let receiveId = req.query.receiveId;
    console.log(receiveId);
    const hospname = JSON.parse(sys_hospital).hospname
    receiveId = Array.isArray(receiveId) ? receiveId : [receiveId];
    const rs: any = await mainReportModel.accountPayableByReceiveId(db, receiveId);
    let arRs = [];

    for (const v of receiveId) {
      let idx = _.findIndex(rs, { 'receive_id': +v });
      if (idx > -1) arRs.push(rs[idx]);
    }

    if (rs.length > 0) {
      let sum: any = 0;
      for (const i of rs) {
        i.delivery_date = moment(i.delivery_date).locale('th').format('DD MMM') + (moment(i.delivery_date).get('year') + 543);
        sum += i.cost;
        i.cost = inventoryReportModel.comma(i.cost);
      }
      sum = inventoryReportModel.comma(sum);
      res.render('account_payable', {
        hospname: hospname,
        details: arRs,
        sumCost: sum,
        genericTypeName: '',
        printDate: 'วันที่พิมพ์ ' + moment().format('D MMMM ') + (moment().get('year') + 543) + moment().format(', HH:mm:ss น.')
      });
    } else {
      res.render('error404')
    }

  } catch (error) {
    res.render('error404', {
      title: error
    })
  }
}));

router.get('/requisition/sum', wrap(async (req, res, next) => {
  let db = req.db;
  let startDate = req.query.startDate;
  let endDate = req.query.endDate;
  let warehouseId = req.decoded.warehouseId;

  let _startDate = moment(startDate).locale('th').format('D MMM') + (moment(startDate).get('year') + 543);
  let _endDate = moment(endDate).locale('th').format('D MMM') + (moment(endDate).get('year') + 543);
  const rsR = await mainReportModel.requisitionSum(db, startDate, endDate, warehouseId);
  
  res.render('requisition_sum', {
    rsR: rsR[0],
    startDate: _startDate,
    endDate: _endDate
  });
}));

export default router;