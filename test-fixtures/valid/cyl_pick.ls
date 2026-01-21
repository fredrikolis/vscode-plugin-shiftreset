/PROG  CYL_PICK
/ATTR
OWNER		= MNEDITOR;
COMMENT		= "";
PROG_SIZE	= 548;
CREATE		= DATE 24-01-23  TIME 05:57:44;
MODIFIED	= DATE 25-09-11  TIME 00:54:24;
FILE_NAME	= ;
VERSION		= 0;
LINE_COUNT	= 28;
MEMORY_SIZE	= 940;
PROTECT		= READ_WRITE;
TCD:  STACK_SIZE	= 0,
      TASK_PRIORITY	= 50,
      TIME_SLICE	= 0,
      BUSY_LAMP_OFF	= 0,
      ABORT_REQUEST	= 0,
      PAUSE_REQUEST	= 0;
DEFAULT_GROUP	= 1,*,*,*,*;
CONTROL_CODE	= 00000000 00000000;
/APPL
/MN
   1:  IF (RI[3:OFF:open]=OFF AND RI[4:OFF:closed]=ON) THEN ;
   2:  RO[7:OFF:open]=ON ;
   3:  ENDIF ;
   4:   ;
   5:   ;
   6:L PR[14:cyl working] R[9:speed]mm/sec CNT50 Offset,PR[6:z offset short]    ;
   7:  DO[23:OFF:picking]=ON ;
   8:L PR[14:cyl working] R[9:speed]mm/sec FINE    ;
   9:  RO[7:OFF:open]=OFF ;
  10:  WAIT RI[3:OFF:open]=OFF    ;
  11:  WAIT    .20(sec) ;
  12:  IF RI[4:OFF:closed]=OFF,JMP LBL[1] ;
  13:  DO[22:OFF:GRASP FAILED]=ON ;
  14:  RO[7:OFF:open]=ON ;
  15:  WAIT RI[3:OFF:open]=OFF    ;
  16:  WAIT    .20(sec) ;
  17:L PR[14:cyl working] R[9:speed]mm/sec CNT100 Offset,PR[3:z offset]    ;
  18:L PR[4:home] R[9:speed]mm/sec FINE    ;
  19:  DO[23:OFF:picking]=OFF ;
  20:  WAIT  30.00(sec) ;
  21:  JMP LBL[2] ;
  22:   ;
  23:  LBL[1] ;
  24:L PR[14:cyl working] R[9:speed]mm/sec CNT100 Offset,PR[3:z offset]    ;
  25:  DO[22:OFF:GRASP FAILED]=OFF ;
  26:  DO[23:OFF:picking]=OFF ;
  27:   ;
  28:  LBL[2] ;
/POS
/END
