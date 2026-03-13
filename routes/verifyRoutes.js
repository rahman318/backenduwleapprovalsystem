// routes/verifyRoutes.js
import express from "express";
import Request from "../models/Requests.js";

const router = express.Router();

// GET /verify/:serialNumber
router.get("/:serialNumber", async (req,res)=>{
  try{
    const { serialNumber } = req.params;
    const request = await Request.findOne({ serialNumber }).lean();
    if(!request) return res.status(404).send("Permohonan tak jumpa bossskurrr 😢");

    // Hantar page HTML ringkas untuk verify
    res.send(`
      <h1>Verification Result</h1>
      <p>No Siri: ${request.serialNumber}</p>
      <p>Staff: ${request.staffName}</p>
      <p>Jenis Permohonan: ${request.requestType}</p>
      <p>Status: ${request.approvals?.length && request.approvals.every(a=>"APPROVED"===a.status.toUpperCase())?"LULUS":"DITOLAK / PENDING"}</p>
    `);
  }catch(err){ console.error(err); res.status(500).send("Server error bossskurrr 😢"); }
});

export default router;