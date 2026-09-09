/* ================================================
   loan-calc.js - 貸款計算模組
   ================================================ */

'use strict';
window.PRO = window.PRO || {}; var PRO = window.PRO;

PRO.loanCalc = (() => {

  /**
   * 計算本息平均攤還
   * @param {number} principal 本金總額
   * @param {number} annualRate 年利率 (%)
   * @param {number} totalMonths 總期數(月)
   * @param {number} graceMonths 寬限期(月)
   * @returns {object} { monthlyPayment (含本息), monthlyInterest (寬限期利息), schedule: [] }
   */
  function calcMortgage(principal, annualRate, totalMonths, graceMonths = 0) {
    if (totalMonths <= 0 || principal <= 0) return { monthlyPayment: 0, monthlyInterest: 0, schedule: [] };
    
    const monthlyRate = annualRate / 100 / 12;
    const repayMonths = totalMonths - graceMonths;
    const schedule = [];
    
    // 寬限期每月只繳利息
    const graceInterest = monthlyRate > 0 ? Math.round(principal * monthlyRate) : 0;
    
    let remaining = principal;
    
    // 寬限期排程
    for (let i = 1; i <= graceMonths; i++) {
      schedule.push({
        month: i,
        payment: graceInterest,
        principal: 0,
        interest: graceInterest,
        remaining: remaining
      });
    }
    
    // 本息平均攤還每月應繳金額
    // 算法: PMT = P * r * (1+r)^n / ((1+r)^n - 1)
    let pmt = 0;
    if (repayMonths > 0) {
      if (monthlyRate > 0) {
        const factor = Math.pow(1 + monthlyRate, repayMonths);
        pmt = principal * monthlyRate * factor / (factor - 1);
      } else {
        pmt = principal / repayMonths;
      }
    }
    pmt = Math.round(pmt);
    
    // 還款期排程
    for (let i = 1; i <= repayMonths; i++) {
      const interest = Math.round(remaining * monthlyRate);
      let p = pmt - interest;
      if (i === repayMonths) {
        // 最後一期把剩餘本金一次結清
        p = remaining;
        pmt = p + interest;
      }
      remaining -= p;
      schedule.push({
        month: graceMonths + i,
        payment: pmt,
        principal: p,
        interest: interest,
        remaining: remaining < 0 ? 0 : remaining
      });
    }

    return {
      monthlyPayment: pmt,
      monthlyInterest: graceInterest,
      schedule
    };
  }

  return { calcMortgage };
})();