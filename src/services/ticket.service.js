/**
 * Ticket service.
 * Delegates complaint understanding to the Complaint Analysis Engine.
 */

const { analyzeComplaint } = require('./complaintAnalysis');

const analyzeTicket = async (payload) => {
  const complaintText = (payload && payload.complaint) || '';
  return analyzeComplaint(complaintText);
};

module.exports = {
  analyzeTicket,
};
