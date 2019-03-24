import * as express from 'express';
import * as crypto from 'crypto';
import * as moment from 'moment';
import { ToolModel } from '../models/tool';
import * as _ from 'lodash';
const router = express.Router();

const toolModel = new ToolModel();

router.post('/stockcard/receives/search', async (req, res, next) => {

  let db = req.db;
  let query = req.body.query;

  try {
    let rs: any = await toolModel.searchReceives(db, query);
    res.send({ ok: true, rows: rs[0] });
  } catch (error) {
    console.log(error);
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

});

router.post('/stockcard/requisitions/search', async (req, res, next) => {
  let db = req.db;
  let query = req.body.query;
  try {
    let rs: any = await toolModel.searchRequisitions(db, query);
    res.send({ ok: true, rows: rs[0] });
  } catch (error) {
    console.log(error);
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
});

router.post('/stockcard/borrows/search', async (req, res, next) => {
  let db = req.db;
  let query = req.body.query;

  try {
    let rs: any = await toolModel.searchBorrows(db, query);
    console.log(rs);

    res.send({ ok: true, rows: rs[0] });
  } catch (error) {
    console.log(error);
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
});

router.post('/stockcard/tranfers/search', async (req, res, next) => {
  let db = req.db;
  let query = req.body.query;
  try {
    let rs: any = await toolModel.searchTranfers(db, query);
    res.send({ ok: true, rows: rs[0] });
  } catch (error) {
    console.log(error);
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
});

router.post('/stockcard/issues/search', async (req, res, next) => {
  let db = req.db;
  let query = req.body.query;
  try {
    let rs: any = await toolModel.searchIssues(db, query);
    res.send({ ok: true, rows: rs[0] });
  } catch (error) {
    console.log(error);
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
});
router.post('/stockcard/pick/search', async (req, res, next) => {
  let db = req.db;
  let query = req.body.query;
  try {
    let rs: any = await toolModel.searchPick(db, query);
    res.send({ ok: true, rows: rs[0] });
  } catch (error) {
    console.log(error);
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
});
router.post('/stockcard/receives/items', async (req, res, next) => {

  let db = req.db;
  let receiveId = req.body.receiveId;
  let type = req.body.type;

  try {
    let rs: any = type == 'PO' ? await toolModel.getReceivesItems(db, receiveId) : await toolModel.getReceivesOtherItems(db, receiveId);
    res.send({ ok: true, rows: rs[0] });
  } catch (error) {
    console.log(error);
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

});

router.post('/check/password', async (req, res, next) => {
  const db = req.db;
  const password = req.body.password;
  const peopleUserId = req.decoded.people_user_id;
  try {
    let encPassword = crypto.createHash('md5').update(password).digest('hex');
    const rs = await toolModel.checkPassword(db, peopleUserId, encPassword);
    console.log(rs);
    if (rs.length) {
      res.send({ ok: true });
    } else {
      res.send({ ok: false });
    }

  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
});

router.put('/stockcard/receives', async (req, res, next) => {

  let db = req.db;
  let receiveId: any = req.body.receiveId;
  let summary = req.body.summary;
  let products = req.body.products;
  let warehouseId = req.decoded.warehouseId;
  let peopleUserId = req.decoded.people_user_id;
  try {
    await toolModel.updateReceive(db, receiveId, summary);
    for (const v of products) {
      v.expired_date = moment(v.expired_date, 'DD/MM/YYYY').isValid() ? moment(v.expired_date, 'DD/MM/YYYY').format('YYYY-MM-DD') : null;
      v.expired_date_old = moment(v.expired_date_old, 'DD/MM/YYYY').isValid() ? moment(v.expired_date_old, 'DD/MM/YYYY').format('YYYY-MM-DD') : null;
      const dataStock = {
        unit_generic_id: v.unit_generic_id,
        in_qty: v.receive_qty * v.conversion_qty,
        in_unit_cost: v.cost / v.conversion_qty,
        balance_unit_cost: v.cost / v.conversion_qty,
      }

      let qty;
      const qtyNew = v.receive_qty * v.conversion_qty;
      const qtyOld = v.receive_qty_old * v.conversion_qty_old;
      const costNew = v.cost / v.conversion_qty;
      const costOld = v.cost_old / v.conversion_qty_old;

      // check cost receive new 62/03/24 12:00:00
      const rs = await toolModel.getWmProductId(db, 'REV', receiveId, v.product_id, v.lot_no_old, v.expired_date_old);
      const wmProductId = rs[0].wm_product_id_in;

      ////////////////////////////////////
      if (qtyNew > qtyOld) {
        qty = qtyNew - qtyOld;
        await toolModel.increasingQtyWM(db, wmProductId, qty) // เพิ่มขึ้น
      } else if (qtyNew < qtyOld) {
        qty = qtyOld - qtyNew;
        await toolModel.decreaseQtyWM(db, wmProductId, qty) // ลดลง
      }
      if (v.lot_no != v.lot_no_old || v.expired_date != v.expired_date_old || v.unit_generic_id != v.unit_generic_id_old || costOld != costNew) {
        await toolModel.changeLotWmProductWM(db, v.lot_no, v.expired_date, v.unit_generic_id, costNew, wmProductId)
        await toolModel.changeLotStockcardWM(db, v.lot_no, v.expired_date, wmProductId);
      }
      await toolModel.updateReceiveDetail(db, receiveId, v);
      // const stockCardId = await toolModel.getStockCardId(db, receiveId, v.product_id, v.lot_no_old, 'REV');
      await toolModel.updateStockcard(db, dataStock, rs[0].stock_card_id);

      ///////////////save log/////////////////
      if (qtyOld != qtyNew || v.lot_no_old != v.lot_no || v.expired_date_old != v.expired_date) {
        const logs = {
          stock_card_log_date: moment().format('YYYY-MM-DD HH:mm:ss'),
          stock_card_id: rs[0].stock_card_id,
          in_qty_old: qtyOld,
          in_unit_cost_old: costOld,
          out_qty_old: null,
          out_unit_cost_old: null,
          lot_no_old: v.lot_no_old,
          expired_date_old: v.expired_date_old,

          in_qty_new: qtyNew,
          in_unit_cost_new: costNew,
          out_qty_new: null,
          out_unit_cost_new: null,
          lot_no_new: v.lot_no,
          expired_date_new: v.expired_date,
          people_user_id: peopleUserId
        }
        await toolModel.saveLogs(db, logs);
      }

      ////////////////////////////////

      let product: any = [];
      let lists = await toolModel.getStockcardList(db, warehouseId, v.generic_id); // รายการทั้งหทก
      let productId = await toolModel.getStockcardProduct(db, warehouseId, v.generic_id); //product id
      for (const pd of productId) {
        const obj: any = {
          generic_id: v.generic_id,
          product_id: pd.product_id,
          product_qty: 0,
          generic_qty: 0
        }
        product.push(obj);
      }
      for (const pd of lists) {
        const idxG = _.findIndex(product, { generic_id: v.generic_id });
        if (idxG > -1) {
          product[idxG].generic_qty += +pd.in_qty;
          product[idxG].generic_qty -= +pd.out_qty;
          const idx = _.findIndex(product, { product_id: pd.product_id });
          if (idx > -1) {
            product[idx].product_qty += +pd.in_qty;
            product[idx].product_qty -= +pd.out_qty;

          }
          const obj: any = {
            stock_card_id: pd.stock_card_id,
            balance_qty: product[idx].product_qty,
            balance_generic_qty: product[idxG].generic_qty
          }
          if (pd.balance_qty != obj.balance_qty || pd.balance_generic_qty != obj.balance_generic_qty) {
            await toolModel.updateStockcardList(db, obj);
          }
        }
      }

      // await adjustStockcard(db, warehouseId, v.generic_id);
    }
    res.send({ ok: true });
  } catch (error) {
    console.log(error);
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

});

router.put('/stockcard/receive-others', async (req, res, next) => {

  let db = req.db;
  let receiveOtherId: any = req.body.receiveOtherId;
  let products = req.body.products;
  let summary = req.body.summary;
  let warehouseId = req.decoded.warehouseId;
  let peopleUserId = req.decoded.people_user_id;
  try {
    await toolModel.updateReceiveOther(db, receiveOtherId, summary);
    for (const v of products) {
      v.expired_date = moment(v.expired_date, 'DD/MM/YYYY').isValid() ? moment(v.expired_date, 'DD/MM/YYYY').format('YYYY-MM-DD') : null;
      v.expired_date_old = moment(v.expired_date_old, 'DD/MM/YYYY').isValid() ? moment(v.expired_date_old, 'DD/MM/YYYY').format('YYYY-MM-DD') : null;
      const dataStock = {
        unit_generic_id: v.unit_generic_id,
        in_qty: v.receive_qty * v.conversion_qty,
        in_unit_cost: v.cost / v.conversion_qty,
        balance_unit_cost: v.cost / v.conversion_qty,
        // lot_no: v.lot_no,
        // expired_date: v.expired_date
      }

      let qty;
      const qtyNew = v.receive_qty * v.conversion_qty;
      const qtyOld = v.receive_qty_old * v.conversion_qty_old;
      const costNew = v.cost / v.conversion_qty;
      const costOld = v.cost_old / v.conversion_qty_old;
      if (qtyNew > qtyOld) {
        qty = qtyNew - qtyOld;
        await toolModel.increasingQty(db, v.product_id, v.lot_no_old, warehouseId, qty) // เพิ่มขึ้น
      } else if (qtyNew < qtyOld) {
        qty = qtyOld - qtyNew;
        await toolModel.decreaseQty(db, v.product_id, v.lot_no_old, warehouseId, qty) // ลดลง
      }
      if (v.lot_no != v.lot_no_old || v.expired_date != v.expired_date_old || v.unit_generic_id != v.unit_generic_id_old) {
        await toolModel.changeLotWmProduct(db, v.product_id, v.lot_no_old, v.lot_no, v.expired_date_old, v.expired_date, warehouseId, v.unit_generic_id_old, v.unit_generic_id) // เพิ่มขึ้น
        await toolModel.changeLotStockcard(db, v.product_id, v.lot_no_old, v.lot_no, v.expired_date_old, v.expired_date, warehouseId);
      }
      await toolModel.updateReceiveOtherDetail(db, receiveOtherId, v);
      const stockCardId = await toolModel.getStockCardId(db, receiveOtherId, v.product_id, v.lot_no_old, 'REV_OTHER');
      await toolModel.updateStockcard(db, dataStock, stockCardId[0].stock_card_id);

      ///////////////save log/////////////////
      if (qtyOld != qtyNew || v.lot_no_old != v.lot_no || v.expired_date_old != v.expired_date) {
        const logs = {
          stock_card_log_date: moment().format('YYYY-MM-DD HH:mm:ss'),
          stock_card_id: stockCardId[0].stock_card_id,
          in_qty_old: qtyOld,
          in_unit_cost_old: costOld,
          out_qty_old: 0,
          out_unit_cost_old: 0,
          lot_no_old: v.lot_no_old,
          expired_date_old: v.expired_date_old,

          in_qty_new: qtyNew,
          in_unit_cost_new: costNew,
          out_qty_new: 0,
          out_unit_cost_new: 0,
          lot_no_new: v.lot_no,
          expired_date_new: v.expired_date,
          people_user_id: peopleUserId
        }
        await toolModel.saveLogs(db, logs);
      }

      ////////////////////////////////

      let product: any = [];
      let lists = await toolModel.getStockcardList(db, warehouseId, v.generic_id); // รายการทั้งหทก
      let productId = await toolModel.getStockcardProduct(db, warehouseId, v.generic_id); //product id
      for (const pd of productId) {
        const obj: any = {
          generic_id: v.generic_id,
          product_id: pd.product_id,
          product_qty: 0,
          generic_qty: 0
        }
        product.push(obj);
      }
      for (const pd of lists) {
        const idxG = _.findIndex(product, { generic_id: v.generic_id });
        if (idxG > -1) {
          product[idxG].generic_qty += +pd.in_qty;
          product[idxG].generic_qty -= +pd.out_qty;
          const idx = _.findIndex(product, { product_id: pd.product_id });
          if (idx > -1) {
            product[idx].product_qty += +pd.in_qty;
            product[idx].product_qty -= +pd.out_qty;

          }
          const obj: any = {
            stock_card_id: pd.stock_card_id,
            balance_qty: product[idx].product_qty,
            balance_generic_qty: product[idxG].generic_qty
          }
          if (pd.balance_qty != obj.balance_qty || pd.balance_generic_qty != obj.balance_generic_qty) {
            await toolModel.updateStockcardList(db, obj);
          }
        }
      }

      // await adjustStockcard(db, warehouseId, v.generic_id);
    }
    res.send({ ok: true });
  } catch (error) {
    console.log(error);
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

});

router.put('/stockcard/requisitions', async (req, res, next) => {

  let db = req.db;
  let requisitionId: any = req.body.requisitionId;
  let confirmId: any = req.body.confirmId;
  let summary: any = req.body.summary;
  let products = req.body.products;
  let peopleUserId = req.decoded.people_user_id;
  try {
    await toolModel.updateRequisitionOrder(db, requisitionId, summary);
    for (const v of products) {
      await toolModel.updateRequisitionOrderItems(db, requisitionId, v.generic_id, v.unit_generic_id, v.requisition_qty * v.conversion_qty);
      for (const i of v.confirmItems) {
        const qtyNew = i.confirm_qty * i.conversion_qty;
        const qtyOld = i.confirm_qty_old * i.conversion_qty_old;
        const stockCardIdOut = await toolModel.getStockCardIdOut(db, requisitionId, i.product_id, i.lot_no, 'REQ_OUT', qtyOld);
        const stockCardIdIn = await toolModel.getStockCardIdIn(db, requisitionId, i.product_id, i.lot_no, 'REQ_IN', qtyOld);
        console.log(stockCardIdOut, 'stockCardIdOut', stockCardIdIn, 'stockCardIdIn');
        if (stockCardIdOut.length && stockCardIdIn.length) {

          // ############ ปรับคงคลัง ###############
          let qty = 0;
          if (qtyNew > qtyOld) {
            qty = qtyNew - qtyOld;
            await toolModel.decreaseQty(db, i.product_id, i.lot_no, summary.withdrawWarehouseId, qty) // ลดลง
          } else if (qtyNew < qtyOld) {
            qty = qtyOld - qtyNew;
            await toolModel.increasingQty(db, i.product_id, i.lot_no, summary.withdrawWarehouseId, qty) // เพิ่มขึ้น
          }

          if (qtyNew > qtyOld) {
            qty = qtyNew - qtyOld;
            await toolModel.increasingQty(db, i.product_id, i.lot_no, summary.requisitionWarehouseId, qty) // เพิ่มขึ้น
          } else if (qtyNew < qtyOld) {
            qty = qtyOld - qtyNew;
            await toolModel.decreaseQty(db, i.product_id, i.lot_no, summary.requisitionWarehouseId, qty) // ลดลง
          }
          // #####################################
          await toolModel.updateRequisitionConfirmItems(db, confirmId, i.wm_product_id, qtyNew);

          const dataStockOut = {
            out_qty: qtyNew
          }

          const dataStockIn = {
            in_qty: qtyNew
          }



          await toolModel.updateStockcard(db, dataStockOut, stockCardIdOut[0].stock_card_id);
          await toolModel.updateStockcard(db, dataStockIn, stockCardIdIn[0].stock_card_id);

          // ############ save log ###############
          if (qtyOld != qtyNew) {
            const logIn = {
              stock_card_log_date: moment().format('YYYY-MM-DD HH:mm:ss'),
              stock_card_id: stockCardIdIn[0].stock_card_id,
              in_qty_old: qtyOld,
              in_unit_cost_old: null,
              out_qty_old: null,
              out_unit_cost_old: null,
              lot_no_old: null,
              expired_date_old: null,

              in_qty_new: qtyNew,
              in_unit_cost_new: null,
              out_qty_new: null,
              out_unit_cost_new: null,
              lot_no_new: null,
              expired_date_new: null,
              people_user_id: peopleUserId
            }
            const logOut = {
              stock_card_log_date: moment().format('YYYY-MM-DD HH:mm:ss'),
              stock_card_id: stockCardIdOut[0].stock_card_id,
              in_qty_old: null,
              in_unit_cost_old: null,
              out_qty_old: qtyOld,
              out_unit_cost_old: null,
              lot_no_old: null,
              expired_date_old: null,

              in_qty_new: null,
              in_unit_cost_new: null,
              out_qty_new: qtyNew,
              out_unit_cost_new: null,
              lot_no_new: null,
              expired_date_new: null,
              people_user_id: peopleUserId
            }
            await toolModel.saveLogs(db, logIn);
            await toolModel.saveLogs(db, logOut);
            // #####################################
          }


          // ############ เกลี่ย stock card ###############
          let product: any = [];
          let lists = await toolModel.getStockcardList(db, summary.withdrawWarehouseId, v.generic_id); // รายการทั้งหทก
          let productId = await toolModel.getStockcardProduct(db, summary.withdrawWarehouseId, v.generic_id); //product id

          for (const pd of productId) {
            const obj: any = {
              generic_id: v.generic_id,
              product_id: pd.product_id,
              product_qty: 0,
              generic_qty: 0
            }
            product.push(obj);
          }

          for (const pd of lists) {
            const idxG = _.findIndex(product, { generic_id: v.generic_id });
            if (idxG > -1) {
              product[idxG].generic_qty += +pd.in_qty;
              product[idxG].generic_qty -= +pd.out_qty;
              const idx = _.findIndex(product, { product_id: pd.product_id });
              if (idx > -1) {
                product[idx].product_qty += +pd.in_qty;
                product[idx].product_qty -= +pd.out_qty;

              }
              const obj: any = {
                stock_card_id: pd.stock_card_id,
                balance_qty: product[idx].product_qty,
                balance_generic_qty: product[idxG].generic_qty
              }
              if (pd.balance_qty != obj.balance_qty || pd.balance_generic_qty != obj.balance_generic_qty) {
                await toolModel.updateStockcardList(db, obj);
              }
            }
          }
          // #####################################
          // ############ เกลี่ย stock card ###############
          product = [];
          lists = [];
          productId = [];

          lists = await toolModel.getStockcardList(db, summary.requisitionWarehouseId, v.generic_id); // รายการทั้งหทก
          productId = await toolModel.getStockcardProduct(db, summary.requisitionWarehouseId, v.generic_id); //product id
          for (const pd of productId) {
            const obj: any = {
              generic_id: v.generic_id,
              product_id: pd.product_id,
              product_qty: 0,
              generic_qty: 0
            }
            product.push(obj);
          }
          for (const pd of lists) {
            const idxG = _.findIndex(product, { generic_id: v.generic_id });
            if (idxG > -1) {
              product[idxG].generic_qty += +pd.in_qty;
              product[idxG].generic_qty -= +pd.out_qty;
              const idx = _.findIndex(product, { product_id: pd.product_id });
              if (idx > -1) {
                product[idx].product_qty += +pd.in_qty;
                product[idx].product_qty -= +pd.out_qty;

              }
              const obj: any = {
                stock_card_id: pd.stock_card_id,
                balance_qty: product[idx].product_qty,
                balance_generic_qty: product[idxG].generic_qty
              }
              if (pd.balance_qty != obj.balance_qty || pd.balance_generic_qty != obj.balance_generic_qty) {
                await toolModel.updateStockcardList(db, obj);
              }
            }
          }
        } else {
          res.send({ ok: false, error: 'ปรับ stockcard ไม่ได้ เนื่องจากหา ใบเบิก,lot_no หรือ จำนวนก่อนปรับไม่เจอ' });
        }
        // #####################################
      }
    }
    res.send({ ok: true });
  } catch (error) {
    console.log(error);
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

});

router.put('/stockcard/transfers', async (req, res, next) => {

  let db = req.db;
  let transferId: any = req.body.transferId;
  let summary: any = req.body.summary;
  let generics = req.body.generics;
  let peopleUserId = req.decoded.people_user_id;
  // let warehouseId = req.decoded.warehouseId;
  try {
    await toolModel.updateTransfer(db, transferId, summary);
    for (const v of generics) {
      await toolModel.updateTransferGeneric(db, v.transfer_generic_id, v.transfer_qty);
      for (const i of v.products) {
        const qtyNew = i.product_qty * i.conversion_qty;
        const qtyOld = i.product_qty_old * i.conversion_qty_old;
        // ############ ปรับคงคลัง ###############
        let qty = 0;
        if (qtyNew > qtyOld) {
          qty = qtyNew - qtyOld;
          await toolModel.decreaseQty(db, i.product_id, i.lot_no, summary.src_warehouse_id, qty) // ลดลง
        } else if (qtyNew < qtyOld) {
          qty = qtyOld - qtyNew;
          await toolModel.increasingQty(db, i.product_id, i.lot_no, summary.src_warehouse_id, qty) // เพิ่มขึ้น
        }

        if (qtyNew > qtyOld) {
          qty = qtyNew - qtyOld;
          await toolModel.increasingQty(db, i.product_id, i.lot_no, summary.dst_warehouse_id, qty) // เพิ่มขึ้น
        } else if (qtyNew < qtyOld) {
          qty = qtyOld - qtyNew;
          await toolModel.decreaseQty(db, i.product_id, i.lot_no, summary.dst_warehouse_id, qty) // ลดลง
        }
        // #####################################
        await toolModel.updateTransferProduct(db, i.transfer_product_id, qtyNew);

        const dataStockOut = {
          out_qty: qtyNew
        }

        const dataStockIn = {
          in_qty: qtyNew
        }
        const stockCardIdOut = await toolModel.getStockCardIdOut(db, transferId, i.product_id, i.lot_no, 'TRN_OUT', qtyOld);
        const stockCardIdIn = await toolModel.getStockCardIdIn(db, transferId, i.product_id, i.lot_no, 'TRN_IN', qtyOld);
        await toolModel.updateStockcard(db, dataStockOut, stockCardIdOut[0].stock_card_id);
        await toolModel.updateStockcard(db, dataStockIn, stockCardIdIn[0].stock_card_id);
        console.log('stockCardIdOut', stockCardIdOut[0].stock_card_id);
        console.log('stockCardIdIn', stockCardIdIn[0].stock_card_id);

        // ############ save log ###############
        if (qtyOld != qtyNew) {
          const logIn = {
            stock_card_log_date: moment().format('YYYY-MM-DD HH:mm:ss'),
            stock_card_id: stockCardIdIn[0].stock_card_id,
            in_qty_old: qtyOld,
            in_unit_cost_old: null,
            out_qty_old: null,
            out_unit_cost_old: null,
            lot_no_old: null,
            expired_date_old: null,

            in_qty_new: qtyNew,
            in_unit_cost_new: null,
            out_qty_new: null,
            out_unit_cost_new: null,
            lot_no_new: null,
            expired_date_new: null,
            people_user_id: peopleUserId
          }
          const logOut = {
            stock_card_log_date: moment().format('YYYY-MM-DD HH:mm:ss'),
            stock_card_id: stockCardIdOut[0].stock_card_id,
            in_qty_old: null,
            in_unit_cost_old: null,
            out_qty_old: qtyOld,
            out_unit_cost_old: null,
            lot_no_old: null,
            expired_date_old: null,

            in_qty_new: null,
            in_unit_cost_new: null,
            out_qty_new: qtyNew,
            out_unit_cost_new: null,
            lot_no_new: null,
            expired_date_new: null,
            people_user_id: peopleUserId
          }
          await toolModel.saveLogs(db, logIn);
          await toolModel.saveLogs(db, logOut);
          // #####################################
        }
      }

      // ############ เกลี่ย stock card ###############
      let product: any = [];
      let lists = await toolModel.getStockcardList(db, summary.src_warehouse_id, v.generic_id); // รายการทั้งหทก
      let productId = await toolModel.getStockcardProduct(db, summary.src_warehouse_id, v.generic_id); //product id

      for (const pd of productId) {
        const obj: any = {
          generic_id: v.generic_id,
          product_id: pd.product_id,
          product_qty: 0,
          generic_qty: 0
        }
        product.push(obj);
      }

      for (const pd of lists) {
        const idxG = _.findIndex(product, { generic_id: v.generic_id });
        if (idxG > -1) {
          product[idxG].generic_qty += +pd.in_qty;
          product[idxG].generic_qty -= +pd.out_qty;
          const idx = _.findIndex(product, { product_id: pd.product_id });
          if (idx > -1) {
            product[idx].product_qty += +pd.in_qty;
            product[idx].product_qty -= +pd.out_qty;

          }
          const obj: any = {
            stock_card_id: pd.stock_card_id,
            balance_qty: product[idx].product_qty,
            balance_generic_qty: product[idxG].generic_qty
          }
          if (pd.balance_qty != obj.balance_qty || pd.balance_generic_qty != obj.balance_generic_qty) {
            await toolModel.updateStockcardList(db, obj);
          }
        }
      }
      // #####################################
      // ############ เกลี่ย stock card ###############
      product = [];
      lists = [];
      productId = [];

      lists = await toolModel.getStockcardList(db, summary.dst_warehouse_id, v.generic_id); // รายการทั้งหทก
      productId = await toolModel.getStockcardProduct(db, summary.dst_warehouse_id, v.generic_id); //product id
      for (const pd of productId) {
        const obj: any = {
          generic_id: v.generic_id,
          product_id: pd.product_id,
          product_qty: 0,
          generic_qty: 0
        }
        product.push(obj);
      }
      for (const pd of lists) {
        const idxG = _.findIndex(product, { generic_id: v.generic_id });
        if (idxG > -1) {
          product[idxG].generic_qty += +pd.in_qty;
          product[idxG].generic_qty -= +pd.out_qty;
          const idx = _.findIndex(product, { product_id: pd.product_id });
          if (idx > -1) {
            product[idx].product_qty += +pd.in_qty;
            product[idx].product_qty -= +pd.out_qty;

          }
          const obj: any = {
            stock_card_id: pd.stock_card_id,
            balance_qty: product[idx].product_qty,
            balance_generic_qty: product[idxG].generic_qty
          }
          if (pd.balance_qty != obj.balance_qty || pd.balance_generic_qty != obj.balance_generic_qty) {
            await toolModel.updateStockcardList(db, obj);
          }
        }
      }
      // #####################################
    }
    res.send({ ok: true });
  } catch (error) {
    console.log(error);
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

});

router.put('/stockcard/issues', async (req, res, next) => {

  let db = req.db;
  let issueId: any = req.body.issueId;
  let summary = req.body.summary;
  let products = req.body.products;
  // let warehouseId = req.decoded.warehouseId;
  let peopleUserId = req.decoded.people_user_id;
  try {
    await toolModel.updateIssue(db, issueId, summary);
    for (const v of products) {
      await toolModel.updateIssueGeneric(db, v);
      for (const i of v.items) {
        await toolModel.updateIssueProduct(db, i);
        const dataStock = {
          out_qty: i.product_qty,
        }
        let qty;
        if (i.product_qty > i.product_qty_old) {
          qty = i.product_qty - i.product_qty_old;
          await toolModel.decreaseQtyWM(db, i.wm_product_id, i.product_qty) // ลดลง
        } else if (i.product_qty < i.product_qty_old) {
          qty = i.product_qty_old - i.product_qty;
          await toolModel.increasingQtyWM(db, i.wm_product_id, i.product_qty) // เพิ่มขึ้น
        }
        const stockCardId = await toolModel.getStockCardId(db, issueId, i.product_id, i.lot_no, 'IST');
        await toolModel.updateStockcard(db, dataStock, stockCardId[0].stock_card_id);

        ///////////////save log/////////////////
        // if (v.product_qty_old != v.product_qty ) {
        const logs = {
          stock_card_log_date: moment().format('YYYY-MM-DD HH:mm:ss'),
          stock_card_id: stockCardId[0].stock_card_id,
          in_qty_old: null,
          in_unit_cost_old: null,
          out_qty_old: i.product_qty_old,
          out_unit_cost_old: null,
          lot_no_old: null,
          expired_date_old: null,

          in_qty_new: null,
          in_unit_cost_new: null,
          out_qty_new: i.product_qty,
          out_unit_cost_new: null,
          lot_no_new: null,
          expired_date_new: null,
          people_user_id: peopleUserId
        }
        await toolModel.saveLogs(db, logs);
        // }
      }
      ////////////////////////////////
      let product: any = [];
      let lists = await toolModel.getStockcardList(db, summary.warehouse_id, v.generic_id); // รายการทั้งหทก
      let productId = await toolModel.getStockcardProduct(db, summary.warehouse_id, v.generic_id); //product id
      for (const pd of productId) {
        const obj: any = {
          generic_id: v.generic_id,
          product_id: pd.product_id,
          product_qty: 0,
          generic_qty: 0
        }
        product.push(obj);
      }
      for (const pd of lists) {
        const idxG = _.findIndex(product, { generic_id: v.generic_id });
        if (idxG > -1) {
          product[idxG].generic_qty += +pd.in_qty;
          product[idxG].generic_qty -= +pd.out_qty;
          const idx = _.findIndex(product, { product_id: pd.product_id });
          if (idx > -1) {
            product[idx].product_qty += +pd.in_qty;
            product[idx].product_qty -= +pd.out_qty;

          }
          const obj: any = {
            stock_card_id: pd.stock_card_id,
            balance_qty: product[idx].product_qty,
            balance_generic_qty: product[idxG].generic_qty
          }
          if (pd.balance_qty != obj.balance_qty || pd.balance_generic_qty != obj.balance_generic_qty) {
            await toolModel.updateStockcardList(db, obj);
          }
        }
      }
      ////////////////////////////////



      // await adjustStockcard(db, warehouseId, v.generic_id);
    }
    res.send({ ok: true });
  } catch (error) {
    console.log(error);
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

});

router.get('/stockcard/history', async (req, res, next) => {

  let db = req.db;
  try {
    let rs: any = await toolModel.getHistory(db);
    res.send({ ok: true, rows: rs[0] });
  } catch (error) {
    console.log(error);
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

});

router.get('/calculate/stockcard', async (req, res, next) => {
  let db = req.db;
  let warehouseId = req.decoded.warehouseId;
  try {
    let generics = await toolModel.adjustStock1(db, warehouseId);
    for (const g of generics[0]) {
      let product: any = [];
      let products = await toolModel.adjustStock2(db, g.generic_id, warehouseId); // รายการทั้งหทก
      // let genericQty = 0;
      // for (const p of products[0]) {
      let productId = await toolModel.adjustStock3(db, g.generic_id, warehouseId); //product id
      for (const pd of productId[0]) {
        const obj: any = {
          generic_id: g.generic_id,
          product_id: pd.product_id,
          product_qty: 0,
          generic_qty: 0
        }
        product.push(obj);
      }
      for (const pd of products[0]) {
        const idxG = _.findIndex(product, { generic_id: g.generic_id });
        if (idxG > -1) {

          product[idxG].generic_qty += +pd.in_qty;
          product[idxG].generic_qty -= +pd.out_qty;

          const idx = _.findIndex(product, { product_id: pd.product_id });
          if (idx > -1) {
            product[idx].product_qty += +pd.in_qty;
            product[idx].product_qty -= +pd.out_qty;

          }
          const obj: any = {
            stock_card_id: pd.stock_card_id,
            product_id: pd.product_id,
            balance_qty: product[idx].product_qty,
            balance_generic_qty: product[idxG].generic_qty
          }
          if (pd.balance_qty != obj.balance_qty || pd.balance_generic_qty != obj.balance_generic_qty) {
            await toolModel.adjustStockUpdate(db, obj);
          }
        }
      }
    }
    console.log('success');

    res.send({ ok: true });
  } catch (error) {
    db.destroy();
    res.send({ ok: false, error: error })
  }

});

router.post('/removestockcard', async (req, res, next) => {
  let db = req.db;
  let warehouseId = req.body.warehouseId;
  console.log(warehouseId);
  try {
    await toolModel.callForecast(db, warehouseId); // ลบ stockcard
    await toolModel.insertProductInStockcard(db, warehouseId) // insertProductInStockcard
    let generics = await toolModel.adjustStock1(db, warehouseId);
    for (const g of generics[0]) {
      let product: any = [];
      let products = await toolModel.adjustStock2(db, g.generic_id, warehouseId); // รายการทั้งหทก
      // let genericQty = 0;
      // for (const p of products[0]) {
      let productId = await toolModel.adjustStock3(db, g.generic_id, warehouseId); //product id
      for (const pd of productId[0]) {
        const obj: any = {
          generic_id: g.generic_id,
          product_id: pd.product_id,
          product_qty: 0,
          generic_qty: 0
        }
        product.push(obj);
      }
      for (const pd of products[0]) {
        const idxG = _.findIndex(product, { generic_id: g.generic_id });
        if (idxG > -1) {

          product[idxG].generic_qty += +pd.in_qty;
          product[idxG].generic_qty -= +pd.out_qty;

          const idx = _.findIndex(product, { product_id: pd.product_id });
          if (idx > -1) {
            product[idx].product_qty += +pd.in_qty;
            product[idx].product_qty -= +pd.out_qty;

          }
          const obj: any = {
            stock_card_id: pd.stock_card_id,
            product_id: pd.product_id,
            balance_qty: product[idx].product_qty,
            balance_generic_qty: product[idxG].generic_qty
          }
          if (pd.balance_qty != obj.balance_qty || pd.balance_generic_qty != obj.balance_generic_qty) {
            await toolModel.adjustStockUpdate(db, obj);
          }
        }
      }
    }
    console.log('success');

    res.send({ ok: true });
  } catch (error) {
    // db.destroy();
    res.send({ ok: false, error: error })
  }

});

router.get('/calculate/balanceunitcost', async (req, res, next) => {

  let db = req.db;
  let warehouseId = req.query.warehouseId;
  try {
    let copyOblect = [];
    let products = [];
    const productId = await toolModel.getProductId(db, warehouseId);
    const result = await toolModel.unitCost(db, warehouseId);
    let resList = result[0];
    for (const _productId of productId[0]) {
      let list: any = _.filter(resList, { 'product_id': _productId.product_id, 'lot_no': _productId.lot_no });

      for (const r of list) {
        const idx = _.findIndex(products, { 'product_id': r.product_id, 'lot_no': r.lot_no, 'warehouse_id': r.warehouse_id });
        if (idx == -1) {
          const obj = {
            stock_card_id: r.stock_card_id,
            product_id: r.product_id,
            warehouse_id: r.warehouse_id,
            lot_no: r.lot_no,
            in_qty: r.in_qty,
            out_qty: r.out_qty,
            in_unit_cost: r.in_unit_cost,
            out_unit_cost: r.out_unit_cost,
            balance_lot_qty: r.balance_lot_qty,
            balance_unit_cost: r.in_qty * r.in_unit_cost / r.in_qty
          }

          products.push(obj);
          // copyOblect.push(obj);
        } else {
          const idxL = _.findLastIndex(products, { 'product_id': r.product_id, 'lot_no': r.lot_no, 'warehouse_id': r.warehouse_id });
          // console.log(products[idxL].balance_lot_qty, ' * ', products[idxL].balance_unit_cost, ' + ', r.in_qty, ' * ', r.in_unit_cost);
          // console.log(products[idxL].balance_lot_qty, ' + ', r.in_qty);
          let _balance = (+products[idxL].balance_lot_qty * +products[idxL].balance_unit_cost) + (+r.in_qty * +r.in_unit_cost)
          let _qty = (+products[idxL].balance_lot_qty + +r.in_qty)
          let buc
          if (r.in_qty > 0 && products[idxL].balance_lot_qty >= 0) {
            if (_balance == 0 && _qty == 0) {
              buc = products[idxL].balance_unit_cost;
            } else {
              buc = _balance / _qty
            }
          } else if (r.out_qty > 0 || products[idxL].balance_lot_qty < 0) {
            buc = products[idxL].balance_unit_cost;
          }
          const obj = {
            stock_card_id: r.stock_card_id,
            product_id: r.product_id,
            warehouse_id: r.warehouse_id,
            lot_no: r.lot_no,
            in_qty: r.in_qty,
            out_qty: r.out_qty,
            in_unit_cost: r.in_unit_cost,
            out_unit_cost: r.out_unit_cost,
            balance_lot_qty: r.balance_lot_qty,
            balance_unit_cost: buc
          }
          products.push(obj);

        }
      }
    }
    let y = 1
    for (const i of products) {
      await toolModel.updateBalanceUnitCost(db, i);
      console.log(y);
      y++;
    }
    console.log('success');
    res.send({ ok: true, rows: products });
  } catch (error) {
    console.log(error);

    res.send({ error: error.message })
  }

});

router.get('/calculate/stockcard/lot', async (req, res, next) => {
  let db = req.db;
  let warehouseId = req.query.warehouseId;
  try {
    let generics = await toolModel.adjustStock1(db, warehouseId);
    for (const g of generics[0]) {
      let product: any = [];
      let products = await toolModel.adjustStock2(db, g.generic_id, warehouseId); // รายการทั้งหทก
      // let genericQty = 0;
      // for (const p of products[0]) {
      let productId = await toolModel.adjustStockLot(db, g.generic_id, warehouseId); //product id
      for (const pd of productId[0]) {
        const obj: any = {
          generic_id: g.generic_id,
          product_id: pd.product_id,
          balance_lot_qty: 0,
          lot_no: pd.lot_no
        }
        product.push(obj);
      }
      for (const pd of products[0]) {
        const idxG = _.findIndex(product, { generic_id: g.generic_id });
        if (idxG > -1) {
          const idx = _.findIndex(product, { product_id: pd.product_id, lot_no: pd.lot_no });
          if (idx > -1) {
            product[idx].balance_lot_qty += +pd.in_qty;
            product[idx].balance_lot_qty -= +pd.out_qty;

          }
          const obj: any = {
            stock_card_id: pd.stock_card_id,
            product_id: pd.product_id,
            balance_lot_qty: product[idx].balance_lot_qty,
          }

          if (pd.balance_lot_qty != obj.balance_lot_qty && (obj.balance_lot_qty || obj.balance_lot_qty >= 0)) {
            console.log(obj);
            await toolModel.adjustStockUpdate(db, obj);
          }
        }
      }
    }
    console.log('success');

    res.send({ ok: true });
  } catch (error) {
    db.destroy();
    res.send({ ok: false, error: error.message })
  }

});
export default router;
