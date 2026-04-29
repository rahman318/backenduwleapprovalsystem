import Ticker from "../models/Ticker.js";

// 🔥 GET all active ticker
export const getTicker = async (req, res) => {
  try {
    const ticker = await Ticker.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(ticker);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 🔥 ADD ticker
export const addTicker = async (req, res) => {
  try {
    const { message } = req.body;

    const newTicker = new Ticker({ message });
    await newTicker.save();

    res.status(201).json(newTicker);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 🔥 DELETE ticker
export const deleteTicker = async (req, res) => {
  try {
    await Ticker.findByIdAndDelete(req.params.id);
    res.json({ message: "Ticker deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};