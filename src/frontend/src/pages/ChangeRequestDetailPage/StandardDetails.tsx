/*
 * This file is part of NER's FinishLine and licensed under GNU AGPLv3.
 * See the LICENSE file in the repository root folder for details.
 */

import { Container, Row, Col } from 'react-bootstrap';
import { ChangeRequestExplanation, StandardChangeRequest } from 'shared';
import PageBlock from '../../layouts/PageBlock';

interface StandardDetailsProps {
  cr: StandardChangeRequest;
}

const StandardDetails: React.FC<StandardDetailsProps> = ({ cr }: StandardDetailsProps) => {
  const spacer = 'mb-2';
  return (
    <PageBlock title={'Standard Change Request Details'}>
      <Container fluid>
        <Row className={spacer}>
          <Col className={spacer} sm={3} md={2} lg={2} xl={1}>
            <b>What</b>
          </Col>
          <Col className={spacer}>{cr.what}</Col>
        </Row>
        <Row className={spacer}>
          <Col className={spacer} xs={4} sm={3} md={2} lg={2} xl={1}>
            <b>Why</b>
          </Col>
          <Col>
            {cr.why.map((ele: ChangeRequestExplanation, idx: number) => (
              <Row key={idx}>
                <Col className={spacer} md={4} lg={3} xl={2}>
                  <b>{ele.type}</b>
                </Col>
                <Col className={spacer}>{ele.explain}</Col>
              </Row>
            ))}
          </Col>
        </Row>
      </Container>
    </PageBlock>
  );
};

export default StandardDetails;
